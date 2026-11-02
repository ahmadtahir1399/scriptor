import "server-only";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import { listPages } from "@/lib/db/queries/papers";
import { logUploadEvent, updatePageTypes } from "@/lib/db/queries/ingestion";
import { enqueueJob } from "@/lib/db/queries/jobs";
import { classifyPages } from "@/lib/ingestion/classifyPages";

/**
 * Stage 2 — IDENTIFY_PAGES.
 *
 * Classifies every page into a `page_type`. Rules resolve the large majority
 * at zero cost; only genuinely ambiguous pages reach the model, batched.
 *
 * IDEMPOTENT: writes are UPDATEs keyed on (upload, page_number), so a retry
 * overwrites the same rows rather than creating new ones.
 */
export async function identifyPagesHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const pages = await listPages(ctx.db, job.paper_upload_id);

  if (pages.length === 0) {
    throw new Error(
      `IDENTIFY_PAGES: no pages found for upload ${job.paper_upload_id} — did PARSE run?`,
    );
  }

  const classified = await classifyPages({
    pages: pages.map((page) => ({
      pageNumber: page.page_number,
      text: page.page_content,
    })),
    attribution: {
      paperUploadId: job.paper_upload_id,
      paperAnalysisId: job.paper_analysis_id,
      analysisJobId: job.id,
      userId: job.user_id,
      operation: "IDENTIFY_PAGES",
    },
  });

  await updatePageTypes(ctx.db, job.paper_upload_id, classified);

  await logUploadEvent(ctx.db, job.paper_upload_id, "pages_identified", {
    pages: classified.length,
    // Cheap signal for spotting a classifier that has started returning
    // everything as BODY.
    body: classified.filter((page) => page.pageType === "BODY").length,
  });

  await enqueueJob(ctx.db, {
    paperAnalysisId: job.paper_analysis_id,
    paperUploadId: job.paper_upload_id,
    kind: "COMPATIBILITY",
  });
}
