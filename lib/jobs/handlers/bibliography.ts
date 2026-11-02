import "server-only";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import { listPages } from "@/lib/db/queries/papers";
import {
  clearReferenceData,
  insertBibliographyReferences,
  requeueReferenceHealthJob,
  setReferenceHealthStatus,
} from "@/lib/db/queries/references";
import { logUploadEvent } from "@/lib/db/queries/ingestion";
import { extractBibliography } from "@/lib/references/extractBibliography";
import { selectReferenceSections } from "@/lib/references/referenceSections";
import {
  runReferenceReconciliation,
  type ReconcileBibItem,
} from "@/lib/jobs/handlers/references";

/**
 * BIBLIOGRAPHY handler — Stage 1 (parse the reference list) plus Stage 2 (parse
 * in-text citations and reconcile), then it hands verification to its own job.
 *
 * The two extraction stages live in one job because the DB ships two reference
 * job kinds, not three: `REFERENCE` is an `llm_operation`, not a `job_kind`, so
 * the deterministic in-text/reconcile step is a continuation here rather than a
 * separately queued unit. Verification, which is independent and network-bound,
 * IS its own job (REFERENCE_HEALTH), chained the way ingestion stages chain.
 *
 * IDEMPOTENT: clears prior reference rows for the analysis before rebuilding, so
 * a retry replaces rather than duplicates. HONEST: a document with no reference
 * section produces no rows and simply marks the feature DONE — the page then
 * shows "no reference section found" rather than a fabricated result.
 */
export async function bibliographyHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const analysisId = job.paper_analysis_id;
  const uploadId = job.paper_upload_id;

  await clearReferenceData(ctx.db, analysisId);

  // EVERY page is loaded, not just the BIBLIOGRAPHY-typed ones: a reference
  // list usually begins partway down the page that ends the conclusion, so
  // filtering by page type here drops every entry above that page break. See
  // selectReferenceSections for the boundary logic.
  const sections = selectReferenceSections(await listPages(ctx.db, uploadId));
  if (sections.length === 0) {
    await setReferenceHealthStatus(ctx.db, analysisId, "DONE");
    await logUploadEvent(ctx.db, uploadId, "reference_no_bibliography");
    return;
  }

  const entries = await extractBibliography({
    pages: sections,
    attribution: {
      paperUploadId: uploadId,
      paperAnalysisId: analysisId,
      analysisJobId: job.id,
      userId: job.user_id,
      operation: "BIBLIOGRAPHY",
    },
  });

  if (entries.length === 0) {
    await setReferenceHealthStatus(ctx.db, analysisId, "DONE");
    return;
  }

  const bibIds = await insertBibliographyReferences(
    ctx.db,
    analysisId,
    uploadId,
    entries.map((entry) => ({
      rawText: entry.rawText,
      authors: entry.parsed.authors,
      title: entry.parsed.title,
      year: entry.parsed.year,
      publisher: entry.parsed.publisher,
      journal: entry.parsed.container,
      volume: entry.parsed.volume,
      issue: entry.parsed.issue,
      pages: entry.parsed.pages,
      doi: entry.parsed.doi,
      url: entry.parsed.url,
      isbn: entry.parsed.isbn,
      entryIndex: entry.entryIndex,
      pageNumber: entry.pageNumber,
    })),
  );

  const bibItems: ReconcileBibItem[] = entries.map((entry, index) => ({
    id: bibIds[index]?.id ?? "",
    authors: entry.parsed.authors,
    year: entry.parsed.year,
    entryIndex: entry.entryIndex,
  }));

  const reconciled = await runReferenceReconciliation(ctx.db, {
    analysisId,
    uploadId,
    bibItems,
    referenceStartPage: sections[0]?.page_number ?? null,
  });

  await logUploadEvent(ctx.db, uploadId, "reference_extracted", {
    bibliography: entries.length,
    in_text: reconciled.inTextCount,
    cited_but_missing: reconciled.citedButMissing,
    listed_but_uncited: reconciled.listedButUncited,
  });

  // Verification is independent and network-bound — its own chained job.
  //
  // Requeue rather than enqueue. `enqueueJob` ignores duplicates on the
  // idempotency key, so if this handler runs a second time within the same
  // analysis — a reaped job, a manual retry — the chained job is already there
  // in DONE and a plain enqueue silently does nothing. The references above
  // were just rebuilt as UNCHECKED, nothing would ever verify them, and
  // `reference_health_status` would sit at GENERATING forever.
  await requeueReferenceHealthJob(ctx.db, analysisId, uploadId);
}
