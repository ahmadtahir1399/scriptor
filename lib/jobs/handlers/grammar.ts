import "server-only";

import { z } from "zod";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import { getCheckVersion } from "@/lib/db/queries/checks";
import { listPages, listWordsForPage } from "@/lib/db/queries/papers";
import {
  clearFindingsForPage,
  getCheckResult,
  insertFindings,
} from "@/lib/db/queries/analyses";
import { resolveModelRole } from "@/lib/ai/models";
import { runGrammarPage } from "@/lib/checks/runGrammar";
import { checkCostCeiling, abortForCost } from "@/lib/analysis/costGuard";

/**
 * GRAMMAR handler — one INDIVIDUAL_PAGES check against ONE page.
 *
 * Writes only findings; the feedback + score for the check as a whole is
 * produced once in post-processing, from the accumulated findings. Doing
 * feedback per page would be nine times the cost for no benefit.
 *
 * IDEMPOTENT: deletes this job's own prior findings — those for this
 * (check_result, page) — before writing, so a retry replaces rather than
 * duplicates. It does NOT clear the whole check_result's findings, which would
 * wipe the other pages' work.
 *
 * FAILURE ISOLATION: a page that fails is logged and skipped; the check still
 * completes with the pages that succeeded, and the analysis with the checks
 * that succeeded.
 */

const payloadSchema = z.object({
  checkId: z.string().uuid(),
  checkResultId: z.string().uuid(),
  pageNumber: z.number().int().positive(),
});

export async function grammarHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const payload = payloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new Error(`GRAMMAR: malformed payload for job ${job.id}`);
  }

  const { checkResultId, pageNumber } = payload.data;

  const cost = await checkCostCeiling(ctx.db, job.paper_analysis_id);
  if (cost.exceeded) {
    await abortForCost(ctx.db, job.paper_analysis_id);
    return;
  }

  const result = await getCheckResult(ctx.db, checkResultId);
  if (!result)
    throw new Error(`GRAMMAR: check_results ${checkResultId} not found`);

  const version = await getCheckVersion(ctx.db, result.check_version_id);
  if (!version) {
    throw new Error(
      `GRAMMAR: check_version ${result.check_version_id} not found`,
    );
  }

  const pages = await listPages(ctx.db, job.paper_upload_id);
  const page = pages.find((candidate) => candidate.page_number === pageNumber);
  if (!page) {
    // The page vanished (re-parse?). Nothing to do; the runner settles this job
    // and advances the barrier either way.
    return;
  }

  const words = await listWordsForPage(ctx.db, job.paper_upload_id, pageNumber);

  const outcome = await runGrammarPage({
    version,
    role: resolveModelRole(version.model),
    page,
    words,
    attribution: {
      paperUploadId: job.paper_upload_id,
      paperAnalysisId: job.paper_analysis_id,
      analysisJobId: job.id,
      userId: job.user_id,
      operation: "GRAMMAR",
    },
  });

  // Idempotency: clear this page's prior findings for this check_result, then
  // write the fresh set. Scoped to the page so other pages survive a retry.
  await clearFindingsForPage(ctx.db, checkResultId, pageNumber);

  await insertFindings(ctx.db, {
    checkResultId,
    analysisId: job.paper_analysis_id,
    findings: outcome.findings,
  });

  if (outcome.droppedUnlocatable > 0) {
    console.warn(
      `[grammar] dropped ${outcome.droppedUnlocatable} unlocatable finding(s) on page ${pageNumber}`,
    );
  }
  // The POST_PROCESSING barrier is advanced by the runner once this job's own
  // status is committed.
}
