import "server-only";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import { listCheckResults, setAnalysisError } from "@/lib/db/queries/analyses";
import { postProcessAnalysis } from "@/lib/checks/postProcess";
import {
  enqueueDefenseQuestions,
  enqueueTodoList,
} from "@/lib/analysis/enqueue";

/**
 * POST_PROCESSING handler — the terminal step, run once after the barrier.
 *
 * Dedupes findings, resolves word ranges, finalises per-page checks, and
 * computes the overall score. On success, `complete_job()` (called by the
 * runner) triggers `recompute_analysis_status`, which flips the analysis to
 * DONE.
 *
 * If EVERY check errored, there is no score to compute and no value to show;
 * the analysis is marked ERROR with reason ALL_CHECKS_FAILED. A partial
 * failure — some checks succeeded — completes normally and shows what worked.
 *
 * IDEMPOTENT: post-processing recomputes from stored state and overwrites, so a
 * retry lands on the same result.
 */
export async function postProcessHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const results = await listCheckResults(ctx.db, job.paper_analysis_id);

  const anySucceeded = results.some((result) => result.status === "DONE");
  const allErrored =
    results.length > 0 && results.every((result) => result.status === "ERROR");

  if (allErrored && !anySucceeded) {
    await setAnalysisError(
      ctx.db,
      job.paper_analysis_id,
      "ALL_CHECKS_FAILED",
      "Every check failed to complete. Please try again.",
    );
    return;
  }

  await postProcessAnalysis(ctx.db, {
    analysisId: job.paper_analysis_id,
    uploadId: job.paper_upload_id,
    userId: job.user_id,
  });

  // Chain the findings-derived sub-jobs LAST — they read the findings we just
  // finalised. Both are optional and independent; a failure in either is
  // isolated to its own feature.
  await enqueueTodoList(ctx.db, job.paper_analysis_id, job.paper_upload_id);
  await enqueueDefenseQuestions(
    ctx.db,
    job.paper_analysis_id,
    job.paper_upload_id,
  );
}
