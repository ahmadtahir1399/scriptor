import "server-only";

import { z } from "zod";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import { getUpload, listPages } from "@/lib/db/queries/papers";
import { getCheckById, getCheckVersion } from "@/lib/db/queries/checks";
import {
  completeCheckResult,
  failCheckResult,
  getCheckResult,
} from "@/lib/db/queries/analyses";
import { resolveModelRole } from "@/lib/ai/models";
import { selectPagesForScope } from "@/lib/checks/pageScope";
import { runCheck, runRequirementCheck } from "@/lib/checks/runCheck";
import { checkCostCeiling, abortForCost } from "@/lib/analysis/costGuard";
import { DEFAULT_PAGE_SCOPE } from "@/lib/analysis/config";
import { requirementScope } from "@/lib/requirements/asCheck";
import {
  completeUploadRequirement,
  failUploadRequirement,
  getRequirement,
} from "@/lib/db/queries/requirements";

/**
 * RUN_CHECK handler — one ALL_PAGES check, two model calls.
 *
 * FAILURE ISOLATION: any error here is caught, written to THIS check's
 * check_results row as an error card, and then swallowed so the barrier still
 * advances. A single failed check must never fail the whole analysis. The one
 * thing that does stop the analysis is the cost ceiling — and even then the
 * completed checks are kept.
 *
 * IDEMPOTENT: the check_results row is created at enqueue and found by id here;
 * a retry overwrites it rather than creating a duplicate.
 */

const payloadSchema = z.object({
  checkId: z.string().uuid(),
  checkResultId: z.string().uuid(),
});

/** A RUN_CHECK job carrying a custom requirement instead of a catalogue check. */
const requirementPayloadSchema = z.object({
  requirementId: z.string().uuid(),
  uploadRequirementId: z.string().uuid(),
});

export async function runCheckHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  // P9 — a requirement check reuses this handler (same engine, same barrier) but
  // grades into upload_requirements, not check_results.
  const requirementPayload = requirementPayloadSchema.safeParse(job.payload);
  if (requirementPayload.success) {
    await runRequirementCheckJob(requirementPayload.data, job, ctx);
    return;
  }

  const payload = payloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new Error(`RUN_CHECK: malformed payload for job ${job.id}`);
  }

  const { checkResultId } = payload.data;

  // Cost gate BEFORE the model call. If we are already over, abort the whole
  // analysis (keeping completed checks) and mark this one skipped.
  const cost = await checkCostCeiling(ctx.db, job.paper_analysis_id);
  if (cost.exceeded) {
    await abortForCost(ctx.db, job.paper_analysis_id);
    await failCheckResult(
      ctx.db,
      checkResultId,
      "Skipped: analysis cost limit reached.",
    );
    return;
  }

  try {
    const result = await getCheckResult(ctx.db, checkResultId);
    if (!result) {
      throw new Error(`RUN_CHECK: check_results ${checkResultId} not found`);
    }

    // Load the EXACT version chosen at enqueue — never re-select an arm here.
    const version = await getCheckVersion(ctx.db, result.check_version_id);
    if (!version) {
      throw new Error(
        `RUN_CHECK: check_version ${result.check_version_id} not found`,
      );
    }

    const upload = await getUpload(ctx.db, job.paper_upload_id);
    if (!upload)
      throw new Error(`RUN_CHECK: upload ${job.paper_upload_id} not found`);

    // Scope from the check's own page_scope. A cover-page check never loads the
    // 118 body pages.
    const check = await getCheckById(ctx.db, result.check_id);
    const scope = check?.page_scope ?? [...DEFAULT_PAGE_SCOPE];

    const allPages = await listPages(ctx.db, job.paper_upload_id);
    const pages = selectPagesForScope(allPages, scope);

    const outcome = await runCheck({
      version,
      role: resolveModelRole(version.model),
      pages,
      attribution: {
        paperUploadId: job.paper_upload_id,
        paperAnalysisId: job.paper_analysis_id,
        analysisJobId: job.id,
        userId: job.user_id,
        operation: "RATED_CHECK",
      },
    });

    await completeCheckResult(ctx.db, checkResultId, {
      feedback: outcome.feedback,
      // Findings stored as JSON; word ranges are resolved in post-processing.
      feedbackStructured: { findings: outcome.findings },
      score: outcome.score,
    });
  } catch (error) {
    // Failure isolation: this check becomes an error card, the analysis lives.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[runCheck] ${checkResultId} failed`, message);
    await failCheckResult(ctx.db, checkResultId, redactPrompt(message));
  }
  // The POST_PROCESSING barrier is advanced by the runner once this job's own
  // status is committed — doing it here would evaluate it a moment too early.
}

/**
 * Strips anything that could be prompt text from an error before it lands in a
 * user-visible column. The prompts are the core IP; a stack trace or model echo
 * must never carry them into check_results.error_message.
 */
function redactPrompt(message: string): string {
  // Keep it short and generic — detail lives in server logs, not the database.
  if (message.length > 200) {
    return "This check could not be completed. Our team has been notified.";
  }
  return message;
}

/**
 * The requirement-check branch. Same failure isolation and barrier advance as a
 * standard check, but the verdict is written to upload_requirements. A pending
 * or errored requirement is reported as such — never silently a pass.
 */
async function runRequirementCheckJob(
  payload: z.infer<typeof requirementPayloadSchema>,
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const { requirementId, uploadRequirementId } = payload;

  const cost = await checkCostCeiling(ctx.db, job.paper_analysis_id);
  if (cost.exceeded) {
    await abortForCost(ctx.db, job.paper_analysis_id);
    await failUploadRequirement(
      ctx.db,
      uploadRequirementId,
      "Skipped: analysis cost limit reached.",
    );
    return;
  }

  try {
    const requirement = await getRequirement(ctx.db, requirementId);
    if (!requirement) {
      throw new Error(
        `RUN_CHECK(requirement): requirement ${requirementId} not found`,
      );
    }

    const allPages = await listPages(ctx.db, job.paper_upload_id);
    const pages = selectPagesForScope(allPages, requirementScope(requirement));

    const verdict = await runRequirementCheck({
      requirement,
      role: "REASONING",
      pages,
      attribution: {
        paperUploadId: job.paper_upload_id,
        paperAnalysisId: job.paper_analysis_id,
        analysisJobId: job.id,
        userId: job.user_id,
        operation: "RATED_CHECK",
      },
    });

    await completeUploadRequirement(ctx.db, uploadRequirementId, {
      isSatisfied: verdict.satisfied,
      evidenceQuote: verdict.evidence_quote,
      explanation: verdict.explanation,
      pageNumber: verdict.page_number,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[runCheck:requirement] ${uploadRequirementId} failed`,
      message,
    );
    await failUploadRequirement(
      ctx.db,
      uploadRequirementId,
      redactPrompt(message),
    );
  }
  // Barrier advanced by the runner; see runCheckHandler.
}
