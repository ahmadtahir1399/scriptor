"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnalysis } from "@/lib/db/queries/analyses";
import {
  createManualItem,
  deleteTodoItem,
  getOrCreateManualGroup,
  getTodoItem,
  getTodoPlan,
  reorderTodoItems,
  requeueTodoJob,
  setPlanDeadline,
  setTodoStatus,
  toggleTodoItem,
  updateTodoItem,
  type TodoGroupWithItems,
} from "@/lib/db/queries/todos";
import { kickWorker } from "@/lib/jobs/kick";
import {
  decodeItemDescription,
  encodeItemDescription,
} from "@/lib/todos/schedule";
import type { JobStatus } from "@/lib/db/enums";
import {
  addTodoSchema,
  deleteTodoSchema,
  generatePlanSchema,
  reorderTodoSchema,
  setDeadlineSchema,
  toggleTodoSchema,
  updateTodoSchema,
} from "@/lib/validations/todo";

/**
 * To-do server actions.
 *
 * Todo tables are user-writable under P1's RLS, so the item mutations run on the
 * user-session client — RLS is the server-side ownership gate. Analysis-scoped
 * actions (add, deadline, generate) also re-verify ownership explicitly. The
 * generation trigger runs the job under the service role.
 */

export type TodoActionResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export interface TodoData {
  status: JobStatus;
  plan: TodoGroupWithItems[];
  /** Submission deadline (ISO), read from the plan's items. */
  deadline: string | null;
}

export async function getTodoData(
  analysisId: string,
): Promise<TodoData | null> {
  const user = await requireSessionUser();
  const db = await createClient();

  const analysis = await getAnalysis(db, analysisId);
  if (!analysis || analysis.user_id !== user.id) return null;

  const plan = await getTodoPlan(db, analysisId);
  const deadline =
    plan.flatMap((group) => group.items).find((item) => item.due_at !== null)
      ?.due_at ?? null;

  return { status: analysis.todo_status, plan, deadline };
}

// ---------------------------------------------------------------------------
// Item mutations (RLS-scoped to the caller's own rows)
// ---------------------------------------------------------------------------

export async function toggleTodo(input: unknown): Promise<TodoActionResult> {
  const parsed = toggleTodoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await requireSessionUser();
    const db = await createClient();
    await toggleTodoItem(db, parsed.data.itemId, parsed.data.done);
    return { ok: true };
  } catch (error) {
    console.error("[todos] toggleTodo failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function addTodo(input: unknown): Promise<TodoActionResult> {
  const parsed = addTodoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const group = await getOrCreateManualGroup(
      db,
      parsed.data.analysisId,
      analysis.paper_id,
    );
    await createManualItem(db, group.id, {
      title: parsed.data.title,
      description: encodeItemDescription(
        parsed.data.description,
        parsed.data.estimateMinutes,
        "manual",
      ),
      sortOrder: Date.now() % 100000,
    });

    revalidatePath(`/analysis/${parsed.data.analysisId}/todos`);
    return { ok: true };
  } catch (error) {
    console.error("[todos] addTodo failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function updateTodo(input: unknown): Promise<TodoActionResult> {
  const parsed = updateTodoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await requireSessionUser();
    const db = await createClient();

    const item = await getTodoItem(db, parsed.data.itemId);
    if (!item) return { ok: false, error: "not_found" };

    // Preserve provenance and re-encode the effort with the new text.
    const decoded = decodeItemDescription(item.description);
    const nextText = parsed.data.description ?? decoded.text;
    const nextMinutes =
      parsed.data.estimateMinutes !== undefined
        ? parsed.data.estimateMinutes
        : decoded.minutes;

    await updateTodoItem(db, parsed.data.itemId, {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      description: encodeItemDescription(
        nextText,
        nextMinutes,
        decoded.provenance,
      ),
    });

    return { ok: true };
  } catch (error) {
    console.error("[todos] updateTodo failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function deleteTodo(input: unknown): Promise<TodoActionResult> {
  const parsed = deleteTodoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await requireSessionUser();
    const db = await createClient();
    await deleteTodoItem(db, parsed.data.itemId);
    return { ok: true };
  } catch (error) {
    console.error("[todos] deleteTodo failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function reorderTodo(input: unknown): Promise<TodoActionResult> {
  const parsed = reorderTodoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await requireSessionUser();
    const db = await createClient();
    await reorderTodoItems(db, parsed.data.groupId, parsed.data.itemIds);
    return { ok: true };
  } catch (error) {
    console.error("[todos] reorderTodo failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function setDeadline(input: unknown): Promise<TodoActionResult> {
  const parsed = setDeadlineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    await setPlanDeadline(db, parsed.data.analysisId, parsed.data.deadline);
    revalidatePath(`/analysis/${parsed.data.analysisId}/todos`);
    return { ok: true };
  } catch (error) {
    console.error("[todos] setDeadline failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Generation trigger (manual generate / regenerate / retry)
// ---------------------------------------------------------------------------

export async function generatePlan(input: unknown): Promise<TodoActionResult> {
  const parsed = generatePlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await setTodoStatus(admin, parsed.data.analysisId, "GENERATING");
    await requeueTodoJob(
      admin,
      parsed.data.analysisId,
      analysis.paper_upload_id,
    );
    kickWorker();

    revalidatePath(`/analysis/${parsed.data.analysisId}/todos`);
    return { ok: true };
  } catch (error) {
    console.error("[todos] generatePlan failed", error);
    return { ok: false, error: "unknown" };
  }
}
