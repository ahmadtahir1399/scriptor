import "server-only";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import { getUpload, listDocumentTypes } from "@/lib/db/queries/papers";
import {
  listPageTypes,
  logUploadEvent,
  setCompatibility,
} from "@/lib/db/queries/ingestion";
import { evaluateCompatibility } from "@/lib/ingestion/compatibility";

/**
 * Stage 3 — COMPATIBILITY.
 *
 * Entirely deterministic; no model call. Writes `is_compatible` and, when
 * rejected, the reason code that the UI maps to a localised message.
 *
 * IDEMPOTENT: recomputes from stored state and overwrites the same two
 * columns, so a retry lands on the same verdict.
 *
 * This handler does NOT enqueue check jobs. P4 owns fan-out; until it lands
 * the upload page correctly ends at "Ready to analyse" with a disabled CTA.
 * The `paper_analyses` row already exists — it is created by the upload action
 * so Realtime has something to subscribe to from the first moment.
 */
export async function compatibilityHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const upload = await getUpload(ctx.db, job.paper_upload_id);
  if (!upload) {
    throw new Error(`COMPATIBILITY: upload ${job.paper_upload_id} not found`);
  }

  const pageTypes = await listPageTypes(ctx.db, upload.id);

  // The per-type character ceiling. Falls back to the largest configured limit
  // if the upload has no document type — better to let an untyped upload
  // through than to reject it on a limit nobody chose.
  const documentTypes = await listDocumentTypes(ctx.db);
  const matched = documentTypes.find(
    (type) => type.code === upload.document_type_code,
  );
  const maxChars =
    matched?.max_chars ??
    documentTypes.reduce((max, type) => Math.max(max, type.max_chars), 0);

  const verdict = evaluateCompatibility({
    pageCount: upload.page_count ?? 0,
    totalWords: upload.word_count ?? 0,
    totalChars: upload.char_count ?? 0,
    pageTypes,
    maxCharsForType: maxChars,
  });

  await setCompatibility(
    ctx.db,
    upload.id,
    verdict.compatible,
    verdict.compatible ? null : verdict.reason,
  );

  await logUploadEvent(
    ctx.db,
    upload.id,
    verdict.compatible ? "compatible" : "incompatible",
    verdict.compatible ? {} : { reason: verdict.reason },
  );
}
