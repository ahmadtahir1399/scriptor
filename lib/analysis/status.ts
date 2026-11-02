import "server-only";

import { enqueueJob } from "@/lib/db/queries/jobs";
import { listJobsForAnalysis } from "@/lib/db/queries/jobs";
import { isJobTerminal } from "@/lib/domain/job";
import type { Db } from "@/lib/db/queries/papers";

/**
 * The fan-out barrier.
 *
 * NOT a blocking wait. When the last check job settles, whoever settled it sees
 * every check terminal and enqueues POST_PROCESSING. No worker ever sleeps
 * holding a slot, and idempotency on the job key means two checks finishing
 * near-simultaneously enqueue it once.
 */

const CHECK_KINDS = new Set(["RUN_CHECK", "GRAMMAR"]);

/** True for the job kinds the POST_PROCESSING barrier counts. */
export function isCheckKind(kind: string): boolean {
  return CHECK_KINDS.has(kind);
}

/**
 * Enqueues POST_PROCESSING iff all check jobs are terminal.
 *
 * ---------------------------------------------------------------------------
 * CALL THIS ONLY AFTER THE SETTLING JOB'S OWN STATUS IS WRITTEN.
 * ---------------------------------------------------------------------------
 * It re-reads the queue and asks whether every check is terminal, so it is only
 * correct once the job that triggered it is DONE (or terminally ERROR) in the
 * database. It used to be called from inside the handlers' `finally` blocks —
 * which run BEFORE the runner writes `complete_job()`. The last check to finish
 * therefore always saw *itself* as still GENERATING, concluded the barrier was
 * unmet, and returned. POST_PROCESSING was never enqueued for any analysis: the
 * checks all completed, and the report then waited forever for a score, a
 * priority list and a to-do plan that nothing was ever going to produce.
 *
 * The runner now calls this after settling each check job, which is the only
 * place the ordering is guaranteed.
 *
 * The unique idempotency key (`{analysis}:POST_PROCESSING`) makes the concurrent
 * case safe: several checks may all observe "everything terminal" at once, but
 * only the first enqueue creates the row; the rest are no-ops.
 */
export async function maybeEnqueuePostProcessing(
  db: Db,
  analysisId: string,
  paperUploadId: string,
): Promise<void> {
  const jobs = await listJobsForAnalysis(db, analysisId);

  const checkJobs = jobs.filter((job) => CHECK_KINDS.has(job.kind));

  // No check jobs at all means this was called too early; nothing to barrier.
  if (checkJobs.length === 0) return;

  const allTerminal = checkJobs.every(isJobTerminal);
  if (!allTerminal) return;

  const postExists = jobs.some((job) => job.kind === "POST_PROCESSING");
  if (postExists) return;

  await enqueueJob(db, {
    paperAnalysisId: analysisId,
    paperUploadId,
    kind: "POST_PROCESSING",
  });
}
