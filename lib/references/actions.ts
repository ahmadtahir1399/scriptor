"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnalysis } from "@/lib/db/queries/analyses";
import {
  clearPairOrphan,
  loadReferenceHealth,
  pairBelongsToAnalysis,
  referenceBelongsToAnalysis,
  requeueReferenceHealthJob,
  resetAllReferenceHealth,
  resetReferenceHealth,
  setReferenceHealthStatus,
  type ReferenceHealthSnapshot,
} from "@/lib/db/queries/references";
import { kickWorker } from "@/lib/jobs/kick";
import type { JobStatus } from "@/lib/db/enums";
import {
  recheckReferenceSchema,
  resolvePairSchema,
  retryVerificationSchema,
} from "@/lib/validations/reference";

/**
 * Reference-health server actions.
 *
 * Every action re-derives the user from the session and re-verifies that the
 * analysis is theirs BEFORE any write. The reference tables grant users SELECT
 * only, so the mutations run under the service role — which is exactly why the
 * ownership check here is not optional: it is the gate the missing user-write
 * policy would otherwise have been.
 *
 * Resolve/dismiss clears the orphan flags on a pair, which feeds straight back
 * into the counts P5's overview and the sub-nav badge derive — one source of
 * truth, updated in place.
 */

export type ReferenceActionResult = { ok: true } | { ok: false; error: string };

/** Loads ownership-checked reference data for the live hook. */
export async function getReferenceHealthData(
  analysisId: string,
): Promise<{ status: JobStatus; snapshot: ReferenceHealthSnapshot } | null> {
  try {
    await requireSessionUser();
    const db = await createClient();

    // RLS scopes this read: another user's id resolves to null.
    const analysis = await getAnalysis(db, analysisId);
    if (!analysis) return null;

    const snapshot = await loadReferenceHealth(db, analysisId);
    return { status: analysis.reference_health_status, snapshot };
  } catch (error) {
    console.error("[references] getReferenceHealthData failed", error);
    return null;
  }
}

/** Marks a reconciliation orphan (either side) resolved. Optimistic in the UI. */
export async function resolveReferenceIssue(
  input: unknown,
): Promise<ReferenceActionResult> {
  const parsed = resolvePairSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    const belongs = await pairBelongsToAnalysis(
      admin,
      parsed.data.pairId,
      parsed.data.analysisId,
    );
    if (!belongs) return { ok: false, error: "not_found" };

    await clearPairOrphan(admin, parsed.data.pairId);
    revalidatePath(`/analysis/${parsed.data.analysisId}/references`);
    return { ok: true };
  } catch (error) {
    console.error("[references] resolveReferenceIssue failed", error);
    return { ok: false, error: "unknown" };
  }
}

/** Re-queues verification for a single reference (the per-row "Recheck"). */
export async function recheckReference(
  input: unknown,
): Promise<ReferenceActionResult> {
  const parsed = recheckReferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    const belongs = await referenceBelongsToAnalysis(
      admin,
      parsed.data.referenceId,
      parsed.data.analysisId,
    );
    if (!belongs) return { ok: false, error: "not_found" };

    await resetReferenceHealth(admin, parsed.data.referenceId);
    await setReferenceHealthStatus(admin, parsed.data.analysisId, "GENERATING");
    await requeueReferenceHealthJob(
      admin,
      parsed.data.analysisId,
      analysis.paper_upload_id,
    );
    kickWorker();

    revalidatePath(`/analysis/${parsed.data.analysisId}/references`);
    return { ok: true };
  } catch (error) {
    console.error("[references] recheckReference failed", error);
    return { ok: false, error: "unknown" };
  }
}

/** Re-runs the whole verification pass (the "Retry verification" button). */
export async function retryVerification(
  input: unknown,
): Promise<ReferenceActionResult> {
  const parsed = retryVerificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await resetAllReferenceHealth(admin, parsed.data.analysisId);
    await setReferenceHealthStatus(admin, parsed.data.analysisId, "GENERATING");
    await requeueReferenceHealthJob(
      admin,
      parsed.data.analysisId,
      analysis.paper_upload_id,
    );
    kickWorker();

    revalidatePath(`/analysis/${parsed.data.analysisId}/references`);
    return { ok: true };
  } catch (error) {
    console.error("[references] retryVerification failed", error);
    return { ok: false, error: "unknown" };
  }
}
