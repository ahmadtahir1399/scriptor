import type { JobStatus } from "@/lib/db/enums";
import type { Tables, TablesInsert } from "@/lib/db/types.generated";
import type { Db } from "@/lib/db/queries/papers";
import { enqueueJob } from "@/lib/db/queries/jobs";
import { MANUAL_GROUP_MARKER } from "@/lib/todos/config";

/**
 * To-do aggregate access — P10.
 *
 * Todos are one of the few analysis-derived tables users may write to, so most
 * of these run on the user-session client (RLS enforces ownership). The
 * generation path (groups + items from the model) and the status column run
 * under the service role in the worker.
 */

export type TodoGroup = Tables<"todo_groups">;
export type TodoItem = Tables<"todo_items">;

export interface TodoGroupWithItems extends TodoGroup {
  items: TodoItem[];
}

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The whole plan for an analysis: groups in order, each with ordered items. */
export async function getTodoPlan(
  db: Db,
  analysisId: string,
): Promise<TodoGroupWithItems[]> {
  const result = await db
    .from("todo_groups")
    .select("*, items:todo_items(*)")
    .eq("paper_analysis_id", analysisId)
    .order("sort_order", { ascending: true })
    .order("sort_order", { referencedTable: "todo_items", ascending: true });

  return unwrap(result, "getTodoPlan") as unknown as TodoGroupWithItems[];
}

/** Progress counts for the sub-nav badge. */
export async function getTodoProgress(
  db: Db,
  analysisId: string,
): Promise<{ total: number; done: number }> {
  const plan = await getTodoPlan(db, analysisId);
  let total = 0;
  let done = 0;
  for (const group of plan) {
    for (const item of group.items) {
      total += 1;
      if (item.is_done) done += 1;
    }
  }
  return { total, done };
}

/** One open, dated task plus the context the deadline nudge needs. */
export interface DueTodoRow {
  id: string;
  title: string;
  dueAt: string;
  userId: string;
  analysisId: string;
  paperId: string;
  paperTitle: string;
}

/**
 * Open tasks due on or before `cutoffIso` — the TODO_DUE_SOON sweep's only read.
 *
 * SERVICE ROLE. It deliberately crosses every user, which is what a sweep is.
 *
 * Backed by `todo_items_due_idx`, the partial index created for exactly this
 * query in 10_todos.sql: `(due_at) where due_at is not null and not is_done`.
 * The three filters below are written to match that predicate so the planner
 * uses it — a sweep that seq-scans every to-do in the product once a day is the
 * thing the index exists to prevent.
 *
 * `limit` is a safety valve, not paging. If a backlog ever exceeds it the sweep
 * nudges the most overdue and picks the rest up on the next run, which is the
 * right failure mode for something that must finish inside a cron invocation.
 */
export async function listDueTodoItems(
  db: Db,
  cutoffIso: string,
  limit = 500,
): Promise<DueTodoRow[]> {
  const result = await db
    .from("todo_items")
    .select(
      "id, title, due_at, user_id, " +
        "group:todo_groups(paper_analysis_id, paper_id, paper:papers(title))",
    )
    .not("due_at", "is", null)
    .eq("is_done", false)
    .lte("due_at", cutoffIso)
    .order("due_at", { ascending: true })
    .limit(limit);

  const rows = unwrap(result, "listDueTodoItems") as unknown as Array<{
    id: string;
    title: string;
    due_at: string | null;
    user_id: string;
    group: {
      paper_analysis_id: string;
      paper_id: string;
      paper: { title: string } | null;
    } | null;
  }>;

  return rows.flatMap((row) => {
    // A task whose group vanished mid-sweep has nowhere to link to. Dropping it
    // is right: the notification's whole value is the deep link.
    if (!row.group || !row.due_at) return [];
    return [
      {
        id: row.id,
        title: row.title,
        dueAt: row.due_at,
        userId: row.user_id,
        analysisId: row.group.paper_analysis_id,
        paperId: row.group.paper_id,
        paperTitle: row.group.paper?.title ?? "",
      },
    ];
  });
}

/** Open tasks on an analysis, for the "N others still open" line. */
export async function countOpenTodos(
  db: Db,
  analysisId: string,
): Promise<number> {
  const result = await db
    .from("todo_items")
    .select("id, group:todo_groups!inner(paper_analysis_id)", {
      count: "exact",
      head: true,
    })
    .eq("is_done", false)
    .eq("group.paper_analysis_id", analysisId);

  if (result.error) {
    throw new Error(`countOpenTodos: ${result.error.message}`);
  }
  return result.count ?? 0;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function setTodoStatus(
  db: Db,
  analysisId: string,
  status: JobStatus,
): Promise<void> {
  const result = await db
    .from("paper_analyses")
    .update({ todo_status: status })
    .eq("id", analysisId);
  if (result.error) throw new Error(`setTodoStatus: ${result.error.message}`);
}

// ---------------------------------------------------------------------------
// Generation writes (service role in the worker)
// ---------------------------------------------------------------------------

/**
 * Deletes the generated groups for an analysis, preserving the student's own
 * (manual) group — identified by the marker in its description. Cascade removes
 * each deleted group's items.
 */
export async function deleteGeneratedGroups(
  db: Db,
  analysisId: string,
): Promise<void> {
  const result = await db
    .from("todo_groups")
    .delete()
    .eq("paper_analysis_id", analysisId)
    .not("description", "ilike", `${MANUAL_GROUP_MARKER}%`);
  if (result.error)
    throw new Error(`deleteGeneratedGroups: ${result.error.message}`);
}

export async function insertTodoGroup(
  db: Db,
  args: {
    analysisId: string;
    paperId: string;
    title: string;
    description: string;
    sortOrder: number;
  },
): Promise<{ id: string }> {
  const result = await db
    .from("todo_groups")
    .insert({
      paper_analysis_id: args.analysisId,
      paper_id: args.paperId,
      title: args.title,
      description: args.description,
      sort_order: args.sortOrder,
    })
    .select("id")
    .single();
  return unwrap(result, "insertTodoGroup");
}

export interface TodoItemInsert {
  title: string;
  description: string;
  findingId: string | null;
  checkResultId: string | null;
  pageNumber: number | null;
  sortOrder: number;
}

export async function insertTodoItems(
  db: Db,
  groupId: string,
  items: readonly TodoItemInsert[],
): Promise<number> {
  if (items.length === 0) return 0;

  const rows: TablesInsert<"todo_items">[] = items.map((item) => ({
    todo_group_id: groupId,
    title: item.title,
    description: item.description,
    finding_id: item.findingId,
    check_result_id: item.checkResultId,
    page_number: item.pageNumber,
    sort_order: item.sortOrder,
  }));

  const result = await db.from("todo_items").insert(rows);
  if (result.error) throw new Error(`insertTodoItems: ${result.error.message}`);
  return rows.length;
}

// ---------------------------------------------------------------------------
// Manual group + item writes (user client)
// ---------------------------------------------------------------------------

export async function getOrCreateManualGroup(
  db: Db,
  analysisId: string,
  paperId: string,
): Promise<{ id: string }> {
  const existing = await db
    .from("todo_groups")
    .select("id")
    .eq("paper_analysis_id", analysisId)
    .ilike("description", `${MANUAL_GROUP_MARKER}%`)
    .maybeSingle();

  const found = unwrap(existing, "getOrCreateManualGroup.find");
  if (found) return found;

  const created = await db
    .from("todo_groups")
    .insert({
      paper_analysis_id: analysisId,
      paper_id: paperId,
      title: "Your tasks",
      description: MANUAL_GROUP_MARKER,
      sort_order: 1000, // manual group sorts last
    })
    .select("id")
    .single();
  return unwrap(created, "getOrCreateManualGroup.create");
}

export async function createManualItem(
  db: Db,
  groupId: string,
  args: { title: string; description: string; sortOrder: number },
): Promise<void> {
  const result = await db.from("todo_items").insert({
    todo_group_id: groupId,
    title: args.title,
    description: args.description,
    sort_order: args.sortOrder,
  });
  if (result.error)
    throw new Error(`createManualItem: ${result.error.message}`);
}

// ---------------------------------------------------------------------------
// Item mutations (user client — RLS scopes to the caller's own rows)
// ---------------------------------------------------------------------------

export async function toggleTodoItem(
  db: Db,
  itemId: string,
  done: boolean,
): Promise<void> {
  const result = await db
    .from("todo_items")
    .update({
      is_done: done,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (result.error) throw new Error(`toggleTodoItem: ${result.error.message}`);
}

export async function updateTodoItem(
  db: Db,
  itemId: string,
  patch: Partial<{ title: string; description: string }>,
): Promise<void> {
  const result = await db.from("todo_items").update(patch).eq("id", itemId);
  if (result.error) throw new Error(`updateTodoItem: ${result.error.message}`);
}

export async function deleteTodoItem(db: Db, itemId: string): Promise<void> {
  const result = await db.from("todo_items").delete().eq("id", itemId);
  if (result.error) throw new Error(`deleteTodoItem: ${result.error.message}`);
}

export async function getTodoItem(
  db: Db,
  itemId: string,
): Promise<TodoItem | null> {
  const result = await db
    .from("todo_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  return unwrap(result, "getTodoItem");
}

/**
 * Re-runs plan generation: resets the existing TODO_LIST job to NONE so the
 * worker claims it fresh, or enqueues one if none exists yet. The unique
 * idempotency key means a plain re-enqueue would be a no-op, which is why the
 * reset is required.
 */
export async function requeueTodoJob(
  db: Db,
  analysisId: string,
  uploadId: string,
): Promise<void> {
  const result = await db
    .from("analysis_jobs")
    .update({
      status: "NONE",
      attempts: 0,
      run_after: new Date().toISOString(),
      claimed_at: null,
      claimed_by: null,
      last_error: null,
      completed_at: null,
    })
    .eq("paper_analysis_id", analysisId)
    .eq("kind", "TODO_LIST")
    .select("id");

  if (result.error) throw new Error(`requeueTodoJob: ${result.error.message}`);

  if ((result.data?.length ?? 0) === 0) {
    await enqueueJob(db, {
      paperAnalysisId: analysisId,
      paperUploadId: uploadId,
      kind: "TODO_LIST",
    });
  }
}

/** Rewrites sort_order for a group's items to match the given order. */
export async function reorderTodoItems(
  db: Db,
  groupId: string,
  itemIds: readonly string[],
): Promise<void> {
  for (let index = 0; index < itemIds.length; index += 1) {
    const result = await db
      .from("todo_items")
      .update({ sort_order: index })
      .eq("id", itemIds[index] as string)
      .eq("todo_group_id", groupId);
    if (result.error)
      throw new Error(`reorderTodoItems: ${result.error.message}`);
  }
}

/**
 * Sets (or clears) the submission deadline for a plan.
 *
 * `todo_items` has no plan-level deadline column, so the date is written onto
 * every item's `due_at` — which the schema already earmarks for the
 * TODO_DUE_SOON notification sweep. Reading it back is any item's `due_at`.
 */
export async function setPlanDeadline(
  db: Db,
  analysisId: string,
  deadlineIso: string | null,
): Promise<void> {
  const groups = await db
    .from("todo_groups")
    .select("id")
    .eq("paper_analysis_id", analysisId);
  const groupIds = unwrap(groups, "setPlanDeadline.groups").map(
    (group) => group.id,
  );
  if (groupIds.length === 0) return;

  const result = await db
    .from("todo_items")
    .update({ due_at: deadlineIso })
    .in("todo_group_id", groupIds);
  if (result.error) throw new Error(`setPlanDeadline: ${result.error.message}`);
}
