import "server-only";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import {
  getAnalysis,
  listCheckResults,
  listFindingsForAnalysis,
} from "@/lib/db/queries/analyses";
import {
  listReferencePairs,
  listUnhealthyReferences,
} from "@/lib/db/queries/references";
import { listRequirementsForUpload } from "@/lib/db/queries/requirements";
import { classifyPair } from "@/lib/domain/reference";
import {
  deleteGeneratedGroups,
  insertTodoGroup,
  insertTodoItems,
  setTodoStatus,
  type TodoItemInsert,
} from "@/lib/db/queries/todos";
import { generateTodoPlan, type TodoSignal } from "@/lib/todos/generate";
import {
  encodeItemDescription,
  parseEffortToMinutes,
} from "@/lib/todos/schedule";
import { CHECK_TASK_SCORE_CEILING, TODO_LIMITS } from "@/lib/todos/config";

/**
 * TODO_LIST handler — the terminal, optional step.
 *
 * Runs AFTER post-processing (it is chained from that handler), because the plan
 * is a transform over completed check_results, findings, reference issues and
 * unmet requirements. It gathers those signals, clusters them into a prioritised
 * plan, and writes todo_groups / todo_items.
 *
 * HONEST: a strong paper with no actionable signals produces an empty plan and a
 * "great shape" state, never invented busywork. IDEMPOTENT: deletes the
 * generated groups first (preserving the student's manual group), so a
 * regeneration replaces rather than duplicates. FAILURE-ISOLATED: an error sets
 * todo_status ERROR (the UI offers retry) and never fails the parent analysis.
 */

interface SignalSource {
  findingId: string | null;
  checkResultId: string | null;
  page: number | null;
}

export async function todoListHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const analysisId = job.paper_analysis_id;
  const uploadId = job.paper_upload_id;

  try {
    const analysis = await getAnalysis(ctx.db, analysisId);
    if (!analysis)
      throw new Error(`TODO_LIST: analysis ${analysisId} not found`);

    const { signals, sources } = await gatherSignals(
      ctx.db,
      analysisId,
      uploadId,
    );

    // Rebuild the generated groups (manual group is preserved by the query).
    await deleteGeneratedGroups(ctx.db, analysisId);

    if (signals.length === 0) {
      // Genuinely nothing to task — a strong draft. Empty plan, DONE.
      await setTodoStatus(ctx.db, analysisId, "DONE");
      return;
    }

    const groups = await generateTodoPlan({
      signals,
      attribution: {
        paperUploadId: uploadId,
        paperAnalysisId: analysisId,
        analysisJobId: job.id,
        userId: job.user_id,
        operation: "POST_PROCESSING",
      },
    });

    let groupOrder = 0;
    for (const group of groups) {
      const items = mapItems(group.items, sources);
      if (items.length === 0) continue; // every task was invented — drop the group

      const inserted = await insertTodoGroup(ctx.db, {
        analysisId,
        paperId: analysis.paper_id,
        title: group.title,
        description: group.description,
        sortOrder: groupOrder,
      });
      await insertTodoItems(ctx.db, inserted.id, items);
      groupOrder += 1;
    }

    await setTodoStatus(ctx.db, analysisId, "DONE");
  } catch (error) {
    console.error(`[todoList] generation failed for ${analysisId}`, error);
    await setTodoStatus(ctx.db, analysisId, "ERROR");
  }
}

/** Builds the signal list and the ref → source map from the analysis's issues. */
async function gatherSignals(
  db: JobContext["db"],
  analysisId: string,
  uploadId: string,
): Promise<{ signals: TodoSignal[]; sources: Map<string, SignalSource> }> {
  const signals: TodoSignal[] = [];
  const sources = new Map<string, SignalSource>();

  const add = (
    ref: string,
    signal: Omit<TodoSignal, "ref">,
    source: SignalSource,
  ): void => {
    signals.push({ ref, ...signal });
    sources.set(ref, source);
  };

  // 1. High/medium findings.
  const findings = await listFindingsForAnalysis(db, analysisId);
  for (const finding of findings) {
    if (finding.is_resolved || finding.severity === "LOW") continue;
    add(
      `f_${finding.id}`,
      {
        summary: truncate(`${finding.title}: ${finding.quote}`),
        severity: finding.severity === "HIGH" ? "high" : "medium",
        page: finding.page_number,
      },
      { findingId: finding.id, checkResultId: null, page: finding.page_number },
    );
  }

  // 2. Low-rated checks.
  const checks = await listCheckResults(db, analysisId);
  for (const result of checks) {
    if (
      result.status !== "DONE" ||
      result.score === null ||
      result.score >= CHECK_TASK_SCORE_CEILING
    )
      continue;
    add(
      `c_${result.id}`,
      {
        summary: truncate(
          result.feedback ??
            `This aspect scored ${Math.round(result.score)}/100.`,
        ),
        severity: result.score < 50 ? "high" : "medium",
        page: null,
      },
      { findingId: null, checkResultId: result.id, page: null },
    );
  }

  // 3. Reference issues — cited-but-missing orphans, plus broken/unfindable refs.
  const pairs = await listReferencePairs(db, analysisId);
  for (const pair of pairs) {
    const classified = classifyPair(pair);
    if (classified?.kind !== "missing_bibliography") continue;
    add(
      `r_${pair.id}`,
      {
        summary: truncate(
          `Citation not found in the bibliography: ${classified.inText.raw_text}`,
        ),
        severity: "medium",
        page: classified.inText.page_number,
      },
      {
        findingId: null,
        checkResultId: null,
        page: classified.inText.page_number,
      },
    );
  }
  const unhealthy = await listUnhealthyReferences(db, analysisId);
  for (const reference of unhealthy) {
    add(
      `rb_${reference.id}`,
      {
        summary: truncate(
          `Reference could not be verified (${reference.health}): ${reference.raw_text}`,
        ),
        severity: "medium",
        page: null,
      },
      { findingId: null, checkResultId: null, page: null },
    );
  }

  // 4. Unmet supported requirements.
  const requirements = await listRequirementsForUpload(db, uploadId);
  for (const requirement of requirements) {
    const result = requirement.upload_requirement;
    if (!result || result.status !== "DONE" || result.is_satisfied !== false)
      continue;
    add(
      `q_${requirement.id}`,
      {
        summary: truncate(`Unmet requirement: ${requirement.title}`),
        severity: requirement.is_mandatory ? "high" : "medium",
        page: result.page_number,
      },
      { findingId: null, checkResultId: null, page: result.page_number },
    );
  }

  return { signals: signals.slice(0, TODO_LIMITS.maxSignals), sources };
}

/** Maps model tasks to insertable items, dropping any task with no valid ref. */
function mapItems(
  items: readonly {
    title: string;
    description: string;
    effort: string;
    refs: string[];
  }[],
  sources: ReadonlyMap<string, SignalSource>,
): TodoItemInsert[] {
  const out: TodoItemInsert[] = [];

  for (const item of items) {
    const candidates = item.refs.filter((ref) => sources.has(ref));
    if (candidates.length === 0) continue; // invented work — dropped

    // Prefer a ref that carries a concrete source (finding or check).
    const primary =
      candidates.find((ref) => {
        const source = sources.get(ref);
        return source?.findingId !== null || source?.checkResultId !== null;
      }) ?? candidates[0];
    const source = sources.get(primary as string) ?? {
      findingId: null,
      checkResultId: null,
      page: null,
    };
    const page =
      source.page ??
      candidates
        .map((ref) => sources.get(ref)?.page ?? null)
        .find((p) => p !== null) ??
      null;

    out.push({
      title: item.title,
      description: encodeItemDescription(
        item.description,
        parseEffortToMinutes(item.effort),
        "generated",
      ),
      findingId: source.findingId,
      checkResultId: source.checkResultId,
      pageNumber: page,
      sortOrder: out.length,
    });

    if (out.length >= TODO_LIMITS.maxItemsPerGroup) break;
  }

  return out;
}

function truncate(text: string, max = 240): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
