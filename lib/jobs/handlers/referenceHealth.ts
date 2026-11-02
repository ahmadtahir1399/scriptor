import "server-only";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import {
  listBibliographyReferences,
  setReferenceHealthStatus,
  updateReferenceHealth,
} from "@/lib/db/queries/references";
import { inferReferenceType, verifyReference } from "@/lib/references/verify";
import {
  makeProviderContext,
  mapLimit,
} from "@/lib/references/providers/index";
import { VERIFY_CONCURRENCY } from "@/lib/references/config";
import { encodeHealthDetail } from "@/lib/validations/reference";

/**
 * REFERENCE_HEALTH handler — verifies every bibliography reference.
 *
 * FAILURE ISOLATION per reference: one source that errors becomes UNCHECKED with
 * a reason, never a crash, and the rest still verify. Verification streams into
 * the UI via Realtime as each reference resolves, which is why each row is
 * written as it completes rather than in one batch at the end.
 *
 * OPTIONAL job: its failure never fails the parent analysis (see
 * OPTIONAL_JOB_KINDS). The status column is flipped to DONE once the pass
 * finishes; until then the References page shows a live "verified N of M" count.
 *
 * IDEMPOTENT: recomputes each verdict from the stored reference and overwrites,
 * so a retry — or the "Recheck" / "Retry verification" actions — lands cleanly.
 */
export async function referenceHealthHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const analysisId = job.paper_analysis_id;

  const references = await listBibliographyReferences(ctx.db, analysisId);
  if (references.length === 0) {
    await setReferenceHealthStatus(ctx.db, analysisId, "DONE");
    return;
  }

  const providerCtx = makeProviderContext();

  await mapLimit(references, VERIFY_CONCURRENCY, async (reference) => {
    try {
      // PRIVACY: only this reference's own fields reach the providers — the
      // thesis body and the student's identity never leave the app.
      const verdict = await verifyReference(
        {
          rawText: reference.raw_text,
          title: reference.title,
          authors: reference.authors,
          year: reference.year,
          doi: reference.doi,
          url: reference.url,
          isbn: reference.isbn,
          type: inferReferenceType(reference),
        },
        providerCtx,
      );
      await updateReferenceHealth(ctx.db, reference.id, verdict);
    } catch (error) {
      console.warn(
        `[referenceHealth] verify failed for ${reference.id}`,
        error,
      );
      await updateReferenceHealth(ctx.db, reference.id, {
        health: "UNCHECKED",
        detail: encodeHealthDetail("unchecked_no_signal", null),
        resolvedUrl: null,
      });
    }
  });

  await setReferenceHealthStatus(ctx.db, analysisId, "DONE");
}
