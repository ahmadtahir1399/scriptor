"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { checkOtpRateLimit } from "@/lib/auth/rateLimit";
import {
  oauthProviderSchema,
  sanitiseNextPath,
  signInSchema,
  verifyOtpSchema,
} from "@/lib/validations/auth";

/**
 * Auth server actions.
 *
 * Two rules run through all of them:
 *
 *  1. **Never confirm whether an email exists.** Success and "no such account"
 *     return byte-identical results. Anything else turns the sign-in form into
 *     an account-enumeration oracle.
 *  2. Errors are returned as values, not thrown. These feed form state, and an
 *     unhandled throw in a server action surfaces to the user as an opaque
 *     digest instead of a message they can act on.
 */

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_email" | "rate_limited" | "invalid_code" | "unknown";
    };

/**
 * Sends a 6-digit sign-in code.
 *
 * Returns `{ ok: true }` for a rejected send as well as a successful one —
 * see rule 1. The only distinguishable outcome is a rate limit, which is a
 * property of the requester rather than of the account.
 */
export async function requestOtp(formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: "invalid_email" };
  }

  const { email } = parsed.data;

  const limit = await checkOtpRateLimit(email);
  if (!limit.allowed) {
    return { ok: false, error: "rate_limited" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Creates the account on first sign-in. handle_new_user() from P1 then
      // provisions the profile, USER role and notification preferences.
      shouldCreateUser: true,
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    // Logged for operators, never surfaced — the message can reveal whether
    // the address is known.
    console.error("[auth] signInWithOtp failed", error.message);
  }

  return { ok: true };
}

/**
 * Verifies the 6-digit code and establishes the session.
 *
 * CURRENTLY UNUSED. The app switched to magic links (`requestOtp` above already
 * sends one via `emailRedirectTo`), so no code is entered — the student clicks
 * the link and `/auth/callback` completes sign-in. Kept for the day SMTP or a
 * token email template exists and the OTP entry screen is restored.
 */
export async function verifyOtp(formData: FormData): Promise<ActionResult> {
  const parsed = verifyOtpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid_code" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error) {
    return { ok: false, error: "invalid_code" };
  }

  return { ok: true };
}

/**
 * Starts an OAuth flow and redirects to the provider.
 *
 * `next` is carried through the provider round trip as a query parameter on
 * the callback URL, and is sanitised again on the way back — the value passes
 * through a third party in between and cannot be trusted on return.
 */
export async function signInWithOAuth(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = oauthProviderSchema.safeParse(formData.get("provider"));
  if (!parsed.success) {
    return { ok: false, error: "unknown" };
  }

  const next = sanitiseNextPath(
    typeof formData.get("next") === "string"
      ? String(formData.get("next"))
      : null,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data,
    options: {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    console.error("[auth] signInWithOAuth failed", error?.message);
    return { ok: false, error: "unknown" };
  }

  redirect(data.url);
}

/** Ends the session and returns to sign-in. Wired to UserMenu from P0. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

/** Re-sends a code. Subject to the same rate limit as the initial request. */
export async function resendOtp(email: string): Promise<ActionResult> {
  const formData = new FormData();
  formData.set("email", email);
  return requestOtp(formData);
}
