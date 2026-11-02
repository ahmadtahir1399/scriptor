"use server";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearFindingsForCheckResult,
  getCheckResult,
  requeueCheckJobs,
  resetCheckResultToWorking,
} from "@/lib/db/queries/analyses";
import { kickWorker } from "@/lib/jobs/kick";
import { retryCheckSchema } from "@/lib/validations/feedback";

/**
 * Retries a single failed check.
 *
 * Re-queues only that check's job(s), clears its findings, and flips its
 * check_results row back to the working state — the card returns to "working"
 * and the other cards are untouched. This is the failure-isolation guarantee
 * made visible: one check can fail and be retried without disturbing the eight
 * that succeeded.
 */

export type RetryResult =
  | { ok: true; requeued: number }
  | { ok: false; error: "not_found" | "not_owned" | "unknown" };

export async function retryCheck(input: unknown): Promise<RetryResult> {
  const parsed = retryCheckSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "not_found" };
  }

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    // Ownership: RLS returns only the caller's own check_result.
    const result = await getCheckResult(db, parsed.data.checkResultId);
    if (!result) {
      return { ok: false, error: "not_owned" };
    }
    if (result.user_id !== user.id) {
      return { ok: false, error: "not_owned" };
    }

    // Job + result writes need the service role (analysis_jobs has no user
    // policy; the status/score columns are service-only).
    const admin = createAdminClient();

    await clearFindingsForCheckResult(admin, result.id);
    await resetCheckResultToWorking(admin, result.id);
    const requeued = await requeueCheckJobs(
      admin,
      result.paper_analysis_id,
      result.check_id,
    );

    kickWorker();

    return { ok: true, requeued };
  } catch (error) {
    console.error("[retryCheck] failed", error);
    return { ok: false, error: "unknown" };
  }
}
