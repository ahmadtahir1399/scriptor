import "server-only";

import {
  analysisNotificationExists,
  createNotification,
  getNotificationPreferences,
  markNotificationEmailed,
  paperNotificationExists,
} from "@/lib/db/queries/notifications";
import { getProfile } from "@/lib/db/queries/identity";
import { shouldEmail } from "@/lib/domain/notification";
import { isEmailConfigured, sendEmail } from "@/lib/email/client";
import type { NotificationType } from "@/lib/db/enums";
import type { Db } from "@/lib/db/queries/papers";
import type { RenderedEmail } from "@/lib/email/templates";

/**
 * The single door every notification goes through.
 *
 * ── WHY ONE FUNCTION AND NOT A CALL AT EACH SITE ─────────────────────────────
 *
 * Five things have to happen together, in order, for one notification: check
 * we haven't already sent it, read the user's preferences, write the in-app
 * row, send the mail the preferences allow, then stamp `emailed_at` on that
 * row. Spread across five handlers that is five chances to forget the
 * preference check — and a student who has turned an email off and receives it
 * anyway has been ignored, not merely inconvenienced.
 *
 * ── IT NEVER THROWS ──────────────────────────────────────────────────────────
 *
 * Every caller is a background job that has already done the expensive work.
 * `postProcessHandler` has finalised the findings and computed the score before
 * it gets here; if this throws, the runner marks the job failed, `fail_job()`
 * applies backoff, and the whole analysis is re-run — because an email provider
 * had a bad minute. So failures are logged and swallowed, exactly like
 * `advanceBarrier` in the runner.
 *
 * The result is returned rather than voided so a caller that wants to log the
 * outcome can, and so the tests can assert on it.
 */

export interface DispatchArgs {
  userId: string;
  type: NotificationType;
  /** The in-app row's title. Short — it renders on one line in the popover. */
  title: string;
  /** The in-app row's supporting line. */
  body?: string;
  /** Deep link the popover navigates to. Relative — this is an in-app href. */
  href?: string | null;
  relatedPaperId?: string | null;
  relatedPaperAnalysisId?: string | null;
  /**
   * The rendered email, or null for an in-app-only notification.
   *
   * Rendered by the CALLER rather than here, because assembling it needs
   * event-specific data (scores, reference counts, todo dates) that this
   * function has no business knowing about. See `lib/notifications/events.ts`.
   */
  email: RenderedEmail | null;
  /**
   * Skip the "have we already sent this?" check.
   *
   * Only for genuinely repeatable events. TODO_DUE_SOON is the one that needs
   * it — a task can legitimately be nudged about more than once as its date
   * approaches, and that sweep does its own narrower dedupe on a time window.
   */
  allowDuplicate?: boolean;
  /**
   * Scopes the dedupe to the current analysis run — `paper_analyses.started_at`.
   *
   * Omit it and the dedupe means "never twice for this analysis, ever", which
   * silences the second run after a student re-runs a corrected document. See
   * `analysisNotificationExists`.
   */
  dedupeSince?: string | null;
}

export interface DispatchResult {
  /** False when deduped, or when the user has in-app notifications off. */
  created: boolean;
  notificationId?: string;
  emailSent: boolean;
  /** Why no email went out. Useful in the worker log; not shown to users. */
  emailSkippedReason?:
    | "no_template"
    | "preference_off"
    | "not_configured"
    | "no_recipient"
    | "anonymized"
    | "send_failed";
}

const NOTHING: DispatchResult = { created: false, emailSent: false };

export async function dispatchNotification(
  db: Db,
  args: DispatchArgs,
): Promise<DispatchResult> {
  try {
    return await dispatch(db, args);
  } catch (error) {
    console.error(
      `[notifications] dispatch failed for ${args.type} (user ${args.userId})`,
      error,
    );
    return NOTHING;
  }
}

async function dispatch(
  db: Db,
  args: DispatchArgs,
): Promise<DispatchResult> {
  // ── 1. Have we already told them? ─────────────────────────────────────────
  if (!args.allowDuplicate && (await alreadySent(db, args))) {
    return NOTHING;
  }

  // ── 2. What have they asked for? ──────────────────────────────────────────
  // Both reads are tolerant of a missing row. `handle_new_user()` creates the
  // preferences row on signup, but a user who predates the trigger, or whose
  // insert failed, must still hear that their analysis finished — `shouldEmail`
  // treats null as "yes, send", because silence is the worse failure.
  const [preferences, profile] = await Promise.all([
    getNotificationPreferences(db, args.userId),
    getProfile(db, args.userId),
  ]);

  // ── 3. The in-app row. ────────────────────────────────────────────────────
  // `in_app_enabled` gates the ROW, not just its display. Writing a row the
  // user asked not to see and hiding it in the client would leave the bell
  // counting notifications that are never shown — and would keep accumulating
  // rows nobody will ever read.
  let notificationId: string | undefined;

  if (preferences?.in_app_enabled ?? true) {
    const created = await createNotification(db, {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      href: args.href,
      relatedPaperId: args.relatedPaperId,
      relatedPaperAnalysisId: args.relatedPaperAnalysisId,
    });
    notificationId = created?.id;
  }

  // ── 4. The email. ─────────────────────────────────────────────────────────
  const skip = emailBlockedBecause(args, preferences, profile);
  if (skip) {
    return { created: Boolean(notificationId), notificationId, emailSent: false, emailSkippedReason: skip };
  }

  const result = await sendEmail({
    // Non-null: `emailBlockedBecause` returns "no_template"/"no_recipient"
    // above unless both of these are present.
    to: profile!.email,
    subject: args.email!.subject,
    html: args.email!.html,
    text: args.email!.text,
  });

  if (!result.ok) {
    // Logged, not thrown. The in-app row already exists, so the student still
    // finds out the moment they open the app — the email was the redundancy,
    // not the only channel.
    console.error(
      `[notifications] email send failed for ${args.type} (user ${args.userId}): ${result.error}`,
    );
    return {
      created: Boolean(notificationId),
      notificationId,
      emailSent: false,
      emailSkippedReason: "send_failed",
    };
  }

  // ── 5. Record that it went. ───────────────────────────────────────────────
  if (notificationId) {
    await markNotificationEmailed(db, notificationId);
  }

  return { created: Boolean(notificationId), notificationId, emailSent: true };
}

/** The dedupe read, routed to whichever relation this type is keyed on. */
async function alreadySent(db: Db, args: DispatchArgs): Promise<boolean> {
  if (args.relatedPaperAnalysisId) {
    return analysisNotificationExists(db, {
      userId: args.userId,
      type: args.type,
      analysisId: args.relatedPaperAnalysisId,
      since: args.dedupeSince,
    });
  }

  if (args.relatedPaperId) {
    return paperNotificationExists(db, {
      userId: args.userId,
      type: args.type,
      paperId: args.relatedPaperId,
    });
  }

  // Keyed to neither — the digest, for instance. Its own sweep owns the
  // cadence, so there is nothing to dedupe against here.
  return false;
}

/**
 * The email gate, as one expression.
 *
 * Kept separate from the send so the ORDER of the checks is legible: consent
 * before configuration before delivery. An anonymised account is refused
 * outright — `anonymize_user` scrambles the profile email, so "sending" to it
 * would either bounce or, worse, reach whoever now owns that address.
 */
function emailBlockedBecause(
  args: DispatchArgs,
  preferences: Parameters<typeof shouldEmail>[1],
  profile: { email: string; is_anonymized: boolean } | null,
): DispatchResult["emailSkippedReason"] | null {
  if (!args.email) return "no_template";
  if (!shouldEmail(args.type, preferences)) return "preference_off";
  if (!profile?.email) return "no_recipient";
  if (profile.is_anonymized) return "anonymized";
  if (!isEmailConfigured()) return "not_configured";
  return null;
}
