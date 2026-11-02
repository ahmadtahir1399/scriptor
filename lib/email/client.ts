import "server-only";

import { Resend } from "resend";

import { readServerEnv, requireResend } from "@/lib/env";

/**
 * The Resend client.
 *
 * `server-only` at the top is the load-bearing line: `RESEND_API_KEY` is a
 * secret with full send rights on the account, and importing this from a client
 * component must fail the BUILD rather than ship the key in a bundle. Same
 * guard `lib/supabase/admin.ts` uses for the service-role key.
 *
 * Constructed lazily and cached. Building it at module load would run
 * `requireResend()` on import, which throws when the key is absent — and since
 * mail is optional, that would take down every environment that simply does not
 * send any.
 */

let cached: { resend: Resend; from: string } | null = null;

function getResend(): { resend: Resend; from: string } {
  if (cached) return cached;

  const env = readServerEnv();
  const { apiKey, from } = requireResend(env);

  cached = { resend: new Resend(apiKey), from };
  return cached;
}

/**
 * Whether mail is configured at all.
 *
 * Callers use this to skip sending without a try/catch, because "no key in this
 * environment" is a normal state here, not an error. Notification code should
 * degrade quietly — a missing key must never fail an analysis that otherwise
 * succeeded, in the same way `analysis_jobs.is_optional` keeps an optional job
 * from failing its parent.
 */
export function isEmailConfigured(): boolean {
  const env = readServerEnv();
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM);
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  /** At least one of html/text must be present — Resend rejects neither. */
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Sends one email, and never throws.
 *
 * A resolved `{ ok: false }` rather than an exception is deliberate. Every
 * caller is a notification fired from a background job that has already done
 * the expensive work; letting a mail failure propagate would mark a completed
 * analysis as failed because a provider had a bad minute. The caller logs and
 * moves on.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email is not configured (RESEND_API_KEY / RESEND_FROM)." };
  }

  if (!args.html && !args.text) {
    return { ok: false, error: "sendEmail requires html or text." };
  }

  try {
    const { resend, from } = getResend();

    const { data, error } = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      // Resend's types require one of html/text; the guard above proves it.
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
    } as Parameters<typeof resend.emails.send>[0]);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Unknown Resend failure.",
    };
  }
}
