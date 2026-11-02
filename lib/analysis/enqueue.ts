import "server-only";

import type { AppLocale, PageType } from "@/lib/db/enums";
import type { Check } from "@/lib/domain/check";
import { enqueueJob } from "@/lib/db/queries/jobs";
import { getChecksByIds } from "@/lib/db/queries/checks";
import { getUploadWithEntitlements, listPages } from "@/lib/db/queries/papers";
import {
  createCheckResult,
  findCheckResult,
  setEstimatedCost,
} from "@/lib/db/queries/analyses";
import { setReferenceHealthStatus } from "@/lib/db/queries/references";
import { setTodoStatus } from "@/lib/db/queries/todos";
import { setDefenseStatus } from "@/lib/db/queries/defense";
import {
  listRequirementsForUpload,
  setUploadRequirementRunning,
} from "@/lib/db/queries/requirements";
import { classifyCheckable } from "@/lib/requirements/classifyCheckable";
import { MAX_ACTIVE_REQUIREMENTS } from "@/lib/requirements/config";
import { loadCheckVersion } from "@/lib/checks/loadCheckVersion";
import { selectIndividualPages } from "@/lib/checks/pageScope";
import { estimateAnalysisCost } from "@/lib/analysis/costGuard";
import type { Db } from "@/lib/db/queries/papers";

/**
 * Fan-out. Turns "Start analysis" into one job per unit of work, all enqueued
 * at once because they are independent — RUN_CHECK for each ALL_PAGES check,
 * and a set of GRAMMAR jobs (one per sampled BODY page) for each
 * INDIVIDUAL_PAGES check.
 *
 * A/B selection happens HERE, once, and the chosen `check_version_id` is
 * written onto the check_results row. The handler then loads that exact version
 * by id — it does not re-select — so a retry cannot land on a different arm and
 * produce two inconsistent results.
 *
 * The job payload carries only IDs and small scalars. The document text is
 * never in a queue row; the handler loads it from the database at run time. A
 * leaked queue row therefore exposes nothing.
 */

export interface EnqueueResult {
  checkJobs: number;
  estimatedCostUsd: number;
}

export async function enqueueAnalysis(
  db: Db,
  args: {
    analysisId: string;
    uploadId: string;
    checkIds: readonly string[];
    locale: AppLocale;
    wordCount: number;
  },
): Promise<EnqueueResult> {
  const checks = await getChecksByIds(db, args.checkIds);

  const allPagesChecks = checks.filter(
    (check) => check.processing_mode === "ALL_PAGES",
  );
  const individualChecks = checks.filter(
    (check) => check.processing_mode === "INDIVIDUAL_PAGES",
  );

  const pages = await listPages(db, args.uploadId);
  const sampledPages =
    individualChecks.length > 0 ? selectIndividualPages(pages) : [];

  // Estimate first, so it is on the analysis even if enqueue fails partway.
  const estimatedCostUsd = estimateAnalysisCost({
    wordCount: args.wordCount,
    allPagesCheckCount: allPagesChecks.length,
    individualPageCount: individualChecks.length * sampledPages.length,
  });
  await setEstimatedCost(db, args.analysisId, estimatedCostUsd);

  let checkJobs = 0;

  for (const check of allPagesChecks) {
    const created = await ensureCheckResult(
      db,
      args.analysisId,
      check,
      args.locale,
    );
    if (!created) continue;

    await enqueueJob(db, {
      paperAnalysisId: args.analysisId,
      paperUploadId: args.uploadId,
      kind: "RUN_CHECK",
      payload: { checkId: check.id, checkResultId: created.checkResultId },
      discriminator: check.id,
    });
    checkJobs += 1;
  }

  for (const check of individualChecks) {
    const created = await ensureCheckResult(
      db,
      args.analysisId,
      check,
      args.locale,
    );
    if (!created) continue;

    // One GRAMMAR job per sampled page, all sharing the check's result row.
    for (const page of sampledPages) {
      await enqueueJob(db, {
        paperAnalysisId: args.analysisId,
        paperUploadId: args.uploadId,
        kind: "GRAMMAR",
        payload: {
          checkId: check.id,
          checkResultId: created.checkResultId,
          pageNumber: page.page_number,
        },
        discriminator: `${check.id}:${page.page_number}`,
      });
      checkJobs += 1;
    }
  }

  // Reference health runs alongside the checks — an independent optional feature,
  // not part of the POST_PROCESSING barrier (that counts only RUN_CHECK/GRAMMAR).
  // Enqueue it when this upload is entitled to it. BIBLIOGRAPHY parses and
  // reconciles, then chains REFERENCE_HEALTH; this only opens the DAG.
  await maybeEnqueueReferenceHealth(db, args.analysisId, args.uploadId);

  // Custom requirements fan out as RUN_CHECK jobs — same engine, graded into
  // upload_requirements. They join the barrier like any other check.
  await maybeEnqueueRequirementChecks(db, args.analysisId, args.uploadId);

  return { checkJobs, estimatedCostUsd };
}

/**
 * Enqueues a requirement-check job for each attached, SUPPORTED requirement.
 *
 * Support is derived, not stored: `classifyCheckable` decides — an unsupported
 * rule (margins, font, spacing) is never run, honouring the feature's honesty.
 * Each check is bound to this analysis and marked running so the report reflects
 * it live. Bounded by `MAX_ACTIVE_REQUIREMENTS`.
 */
async function maybeEnqueueRequirementChecks(
  db: Db,
  analysisId: string,
  uploadId: string,
): Promise<void> {
  const attached = await listRequirementsForUpload(db, uploadId);
  if (attached.length === 0) return;

  const supported = attached
    .filter(
      (item) =>
        classifyCheckable(`${item.title} ${item.description}`, item.category)
          .checkable,
    )
    .slice(0, MAX_ACTIVE_REQUIREMENTS);

  for (const item of supported) {
    const uploadRequirementId = item.upload_requirement?.id;
    if (!uploadRequirementId) continue;

    await setUploadRequirementRunning(db, uploadRequirementId, analysisId);

    await enqueueJob(db, {
      paperAnalysisId: analysisId,
      paperUploadId: uploadId,
      kind: "RUN_CHECK",
      payload: { requirementId: item.id, uploadRequirementId },
      discriminator: `req:${item.id}`,
    });
  }
}

/**
 * Opens the reference-health branch of the analysis DAG when entitled.
 *
 * Sets `reference_health_status` to GENERATING so the report shows a live
 * "verifying" state from first paint, then enqueues the single BIBLIOGRAPHY job
 * — the P9 handler chains the rest. A re-run reuses the same job rows via their
 * idempotency key, so calling this on re-enqueue is safe.
 */
async function maybeEnqueueReferenceHealth(
  db: Db,
  analysisId: string,
  uploadId: string,
): Promise<void> {
  const upload = await getUploadWithEntitlements(db, uploadId);
  const entitled = upload?.upload_entitlements?.allow_reference_health ?? false;
  if (!entitled) return;

  await setReferenceHealthStatus(db, analysisId, "GENERATING");
  await enqueueJob(db, {
    paperAnalysisId: analysisId,
    paperUploadId: uploadId,
    kind: "BIBLIOGRAPHY",
  });
}

/**
 * Enqueues the TODO_LIST job — the action plan — when the upload is entitled.
 *
 * Called from the POST_PROCESSING handler, NOT at analysis start: the plan is a
 * transform over the completed findings, so it must run last in the DAG. Sets
 * `todo_status` to GENERATING so the To-dos tab shows a live "building your
 * plan" state. Idempotent via the job's unique key.
 */
export async function enqueueTodoList(
  db: Db,
  analysisId: string,
  uploadId: string,
): Promise<void> {
  const upload = await getUploadWithEntitlements(db, uploadId);
  const entitled = upload?.upload_entitlements?.allow_todo ?? false;
  if (!entitled) return;

  await setTodoStatus(db, analysisId, "GENERATING");
  await enqueueJob(db, {
    paperAnalysisId: analysisId,
    paperUploadId: uploadId,
    kind: "TODO_LIST",
  });
}

/**
 * Enqueues the DEFENSE_QUESTIONS job when the upload is entitled.
 *
 * Called from the POST_PROCESSING handler, like the to-do plan: the questions
 * target the thesis's finalised weaknesses, so they must be generated after the
 * findings are complete. Independent and optional — its failure never fails the
 * analysis.
 */
export async function enqueueDefenseQuestions(
  db: Db,
  analysisId: string,
  uploadId: string,
): Promise<void> {
  const upload = await getUploadWithEntitlements(db, uploadId);
  const entitled = upload?.upload_entitlements?.allow_defense ?? false;
  if (!entitled) return;

  await setDefenseStatus(db, analysisId, "GENERATING");
  await enqueueJob(db, {
    paperAnalysisId: analysisId,
    paperUploadId: uploadId,
    kind: "DEFENSE_QUESTIONS",
  });
}

/**
 * Creates the check_results row for a check, selecting its version (honouring
 * an A/B test) — or returns the existing row on a re-enqueue.
 *
 * Returns null when the check has no active version in this locale: there is no
 * prompt to run, so enqueueing a job that must fail helps nobody. The check is
 * simply skipped, and the report shows the other checks.
 */
async function ensureCheckResult(
  db: Db,
  analysisId: string,
  check: Check,
  locale: AppLocale,
): Promise<{ checkResultId: string } | null> {
  const existing = await findCheckResult(db, analysisId, check.id);
  if (existing) return { checkResultId: existing.id };

  const loaded = await loadCheckVersion(db, check.id, locale, analysisId);
  if (!loaded) {
    console.warn(
      `[enqueue] no active version for check ${check.code} (${locale}); skipping`,
    );
    return null;
  }

  const result = await createCheckResult(db, {
    analysisId,
    checkId: check.id,
    checkVersionId: loaded.version.id,
    abTestId: loaded.abTestId,
    hiddenBecauseAbTest: loaded.hiddenBecauseAbTest,
  });

  return { checkResultId: result.id };
}

/** Page types present on an upload — used by the action to sanity-check scope. */
export function pageTypesPresent(pageTypes: readonly PageType[]): {
  hasBody: boolean;
} {
  return { hasBody: pageTypes.includes("BODY") };
}
