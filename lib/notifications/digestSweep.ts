import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  listDueDigestSubscribers,
  markDigestSent,
} from "@/lib/db/queries/notifications";
import { loadDigestData } from "@/lib/db/queries/digest";
import { getProfile } from "@/lib/db/queries/identity";
import { isEmailConfigured, sendEmail } from "@/lib/email/client";
import { weeklyDigestEmail } from "@/lib/email/templates";
import { bandForScore } from "@/lib/analysis/presentation";

/**
 * The weekly digest sweep.
 *
 * ── WHY IT DOES NOT GO THROUGH `dispatchNotification` ────────────────────────
 *
 * Every other email in the system is the second channel of a NOTIFICATION: a
 * row exists in `notifications`, the bell shows it, and the email is the
 * redundancy that reaches someone who has closed the tab. The digest has no
 * such row and should not have one — `notification_type` has no member for it,
 * and inventing one would put "here is your week" in a feed whose entire
 * purpose is telling the student that something happened to their thesis.
 *
 * So this is the one place that composes an email directly. It pays for that by
 * carrying its own consent check (`email_weekly_digest`, enforced in the query),
 * its own ledger (`last_digest_sent_at`), and its own recipient resolution.
 *
 * ── OPT-IN, AND THE ONLY EMAIL THAT IS NOT ABOUT AN EVENT ────────────────────
 *
 * `email_weekly_digest` defaults to FALSE in 14_notifications.sql — the only
 * preference that does. A summary nobody asked for is marketing, and the footer
 * says so explicitly ("You turned the weekly digest on in your settings").
 *
 * Never throws: the worker route treats sweeps as best-effort.
 */

/** A week, minus an hour of slack so a slightly-late tick still qualifies. */
const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;

/** The window the digest reports on. */
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How many go out per tick.
 *
 * The worker runs every minute, so a backlog drains at 25/minute rather than
 * being attempted all at once — which is what keeps a growing subscriber list
 * from hitting the provider's rate limit and from pushing this invocation past
 * the route's `maxDuration`.
 */
const BATCH = 25;

export interface DigestSweepResult {
  due: number;
  sent: number;
}

export async function runWeeklyDigestSweep(
  now = new Date(),
): Promise<DigestSweepResult> {
  // Checked before the query, not after: with no mail configured there is
  // nothing this sweep can do, and stamping the ledger would silently burn a
  // week for every subscriber.
  if (!isEmailConfigured()) return { due: 0, sent: 0 };

  const db = createAdminClient();
  const sentBefore = new Date(now.getTime() - DIGEST_INTERVAL_MS).toISOString();
  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();

  const userIds = await listDueDigestSubscribers(db, sentBefore, BATCH);
  if (userIds.length === 0) return { due: 0, sent: 0 };

  let sent = 0;
  for (const userId of userIds) {
    if (await sendDigest(db, userId, since, now)) sent += 1;
  }

  return { due: userIds.length, sent };
}

async function sendDigest(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  since: string,
  now: Date,
): Promise<boolean> {
  try {
    const profile = await getProfile(db, userId);
    // An anonymised account's email is scrambled by `anonymize_user`, so
    // "sending" to it either bounces or reaches whoever owns that address now.
    if (!profile?.email || profile.is_anonymized) {
      await markDigestSent(db, userId, now.toISOString());
      return false;
    }

    const data = await loadDigestData(db, userId, since);

    // A week with nothing in it is not worth an email. Stamped anyway so this
    // user is not re-evaluated every minute for the next seven days.
    if (data.analysesCompleted === 0 && data.openTodos === 0) {
      await markDigestSent(db, userId, now.toISOString());
      return false;
    }

    // Stamped BEFORE the send — see `markDigestSent` for why a failed digest is
    // skipped for a week rather than retried every minute.
    await markDigestSent(db, userId, now.toISOString());

    const rendered = weeklyDigestEmail({
      firstName: firstNameOf(profile.full_name),
      analysesCompleted: data.analysesCompleted,
      findingsResolved: data.findingsResolved,
      openTodos: data.openTodos,
      papers: data.papers.map((paper) => ({
        title: paper.title,
        score: paper.score,
        band: bandForScore(paper.score),
        analysisId: paper.analysisId,
      })),
    });

    const result = await sendEmail({
      to: profile.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (!result.ok) {
      console.error(`[digestSweep] send failed for ${userId}: ${result.error}`);
      return false;
    }

    return true;
  } catch (error) {
    // One subscriber's failure must not end the sweep for the rest of the batch.
    console.error(`[digestSweep] failed for ${userId}`, error);
    return false;
  }
}

/**
 * First name from a full name, for the greeting.
 *
 * Returns "" rather than guessing when there is nothing usable — the template
 * greets with a bare "Morning." in that case, which is better than "Morning,
 * ." or a greeting built from an email local-part the student never chose to be
 * addressed by.
 */
function firstNameOf(fullName: string | null): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 1 ? first : "";
}
