"use server";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getCheckResult,
  setCheckResultHelpfulness,
} from "@/lib/db/queries/analyses";
import { helpfulnessSchema } from "@/lib/validations/feedback";

/**
 * Helpfulness feedback — the eval signal P15/P16 depend on.
 *
 * Ownership is validated server-side before the write: the check_result is
 * loaded through the user-session client (so RLS scopes it), and a result the
 * caller does not own reads back as null → rejected. The write itself also runs
 * under RLS, so this is defence in depth, not the only guard.
 */

export type FeedbackResult = { ok: true } | { ok: false; error: string };

export async function submitHelpfulness(
  input: unknown,
): Promise<FeedbackResult> {
  const parsed = helpfulnessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid feedback.",
    };
  }

  try {
    await requireSessionUser();
    const db = await createClient();

    // Ownership check: RLS returns only the caller's own row.
    const existing = await getCheckResult(db, parsed.data.checkResultId);
    if (!existing) {
      return { ok: false, error: "Not found." };
    }

    // A comment only belongs on a thumbs-down; drop it otherwise so a stale
    // comment cannot linger against a positive rating.
    const comment =
      parsed.data.isHelpful === false ? parsed.data.comment : null;

    await setCheckResultHelpfulness(
      db,
      parsed.data.checkResultId,
      parsed.data.isHelpful,
      comment,
    );

    return { ok: true };
  } catch (error) {
    console.error("[feedback] submitHelpfulness failed", error);
    return { ok: false, error: "Could not save your feedback." };
  }
}
