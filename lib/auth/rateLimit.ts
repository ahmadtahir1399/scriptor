import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { countRecentAttempts, recordAttempt } from "@/lib/db/queries/identity";

/**
 * Abuse control for the OTP endpoint.
 *
 * Runs on the service-role client because `rate_limit_attempts` has RLS
 * enabled and no user policy — a client that could read or delete its own
 * counters would not be rate limited at all.
 */

export const OTP_BUCKET = "otp";
export const OTP_MAX_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Hashes an email for use as a rate-limit key.
 *
 * The raw address is never stored. `rate_limit_attempts` would otherwise
 * become a list of everyone who has ever tried to sign in — a table with no
 * user-facing purpose holding personal data it does not need. Lower-casing
 * first means `A@b.com` and `a@b.com` share one bucket, so varying case cannot
 * be used to multiply the allowance.
 */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Checks and records an OTP request.
 *
 * Fails OPEN on an infrastructure error: if the counter table is unreachable,
 * a legitimate user must still be able to sign in. The alternative — locking
 * everyone out of the product because a telemetry table is down — is a worse
 * outcome than briefly relaxing a throttle, and Supabase applies its own
 * server-side email limits underneath this.
 */
export async function checkOtpRateLimit(
  email: string,
): Promise<RateLimitResult> {
  const identifier = hashEmail(email);
  const since = new Date(Date.now() - WINDOW_MS);

  try {
    const db = createAdminClient();

    const attempts = await countRecentAttempts(
      db,
      OTP_BUCKET,
      identifier,
      since,
    );
    if (attempts >= OTP_MAX_PER_HOUR) {
      return { allowed: false, remaining: 0 };
    }

    await recordAttempt(db, OTP_BUCKET, identifier);

    return { allowed: true, remaining: OTP_MAX_PER_HOUR - attempts - 1 };
  } catch (error) {
    console.error("[rateLimit] counter unavailable, failing open", error);
    return { allowed: true, remaining: OTP_MAX_PER_HOUR };
  }
}
