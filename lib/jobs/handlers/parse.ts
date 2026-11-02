import "server-only";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import { getUpload } from "@/lib/db/queries/papers";
import { logUploadEvent } from "@/lib/db/queries/ingestion";
import { downloadUploadBytes } from "@/lib/upload/storage";
import { looksLikePdf, parsePdf } from "@/lib/ingestion/parsePdf";
import { storeParsedDocument } from "@/lib/ingestion/storeParsedDocument";
import { enqueueJob } from "@/lib/db/queries/jobs";

/**
 * Stage 1 — PARSE.
 *
 * Downloads the PDF, extracts per-page text and per-word geometry, writes
 * `paper_pages` and `words`, then enqueues IDENTIFY_PAGES.
 *
 * IDEMPOTENT: `storeParsedDocument()` clears prior output for the upload
 * before writing, so a retry replaces rather than duplicates. The follow-on
 * enqueue is idempotent too, via P1's unique `idempotency_key`.
 */
export async function parseHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const upload = await getUpload(ctx.db, job.paper_upload_id);
  if (!upload) {
    throw new Error(`PARSE: upload ${job.paper_upload_id} not found`);
  }

  const bytes = await downloadUploadBytes(upload.file_path);

  /*
   * Server-side magic-byte check. The dropzone's `accept` attribute and the
   * Content-Type header are both supplied by the client; this reads the actual
   * bytes, which is the only claim about the file the uploader does not
   * control. A renamed .exe reaches this line looking exactly like a PDF.
   */
  if (!looksLikePdf(bytes)) {
    await logUploadEvent(ctx.db, upload.id, "parse_rejected_not_pdf");
    throw new Error(
      "PARSE: file is not a PDF (magic bytes did not match %PDF-)",
    );
  }

  const parsed = await parsePdf(bytes);

  const stored = await storeParsedDocument(ctx.db, upload.id, parsed);

  await logUploadEvent(ctx.db, upload.id, "parsed", {
    pages: stored.pagesWritten,
    words: stored.wordsWritten,
    chars: stored.totalChars,
  });

  await enqueueJob(ctx.db, {
    paperAnalysisId: job.paper_analysis_id,
    paperUploadId: job.paper_upload_id,
    kind: "IDENTIFY_PAGES",
  });
}
