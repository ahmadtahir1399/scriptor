import type { NotificationType } from "@/lib/db/enums";
import type {
  Notification,
  NotificationPreferences,
} from "@/lib/domain/notification";
import type { Db } from "@/lib/db/queries/papers";

/** Notification reads and the writes a user is permitted — P15. */

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

/** The popover feed. Capped — nobody scrolls a notification list to page four. */
export async function listNotifications(
  db: Db,
  limit = 30,
): Promise<Notification[]> {
  const result = await db
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return unwrap(result, "listNotifications");
}

export async function listUnreadNotifications(
  db: Db,
  limit = 30,
): Promise<Notification[]> {
  const result = await db
    .from("notifications")
    .select("*")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  return unwrap(result, "listUnreadNotifications");
}

/**
 * Unread count for the topbar badge.
 *
 * Uses a head-only count so no rows cross the wire — this runs on every page
 * load, and the badge needs a number, not a feed. Backed by the partial index
 * `notifications_unread_idx`.
 */
export async function countUnreadNotifications(db: Db): Promise<number> {
  const result = await db
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  if (result.error) {
    throw new Error(`countUnreadNotifications: ${result.error.message}`);
  }
  return result.count ?? 0;
}

/** `read_at` is the only column in the notifications UPDATE grant. */
export async function markNotificationRead(
  db: Db,
  notificationId: string,
): Promise<void> {
  const result = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (result.error) {
    throw new Error(`markNotificationRead: ${result.error.message}`);
  }
}

export async function markAllNotificationsRead(db: Db): Promise<void> {
  const result = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (result.error) {
    throw new Error(`markAllNotificationsRead: ${result.error.message}`);
  }
}

export async function deleteNotification(
  db: Db,
  notificationId: string,
): Promise<void> {
  const result = await db
    .from("notifications")
    .delete()
    .eq("id", notificationId);
  if (result.error) {
    throw new Error(`deleteNotification: ${result.error.message}`);
  }
}

export async function getNotificationPreferences(
  db: Db,
  userId: string,
): Promise<NotificationPreferences | null> {
  const result = await db
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return unwrap(result, "getNotificationPreferences");
}

export async function updateNotificationPreferences(
  db: Db,
  userId: string,
  patch: Partial<
    Pick<
      NotificationPreferences,
      | "email_analysis_complete"
      | "email_analysis_failed"
      | "email_reference_issues"
      | "email_todo_due_soon"
      | "email_weekly_digest"
      | "in_app_enabled"
    >
  >,
): Promise<void> {
  const result = await db
    .from("notification_preferences")
    .update(patch)
    .eq("user_id", userId);

  if (result.error) {
    throw new Error(`updateNotificationPreferences: ${result.error.message}`);
  }
}

/**
 * Creates a notification. SERVICE ROLE ONLY.
 *
 * There is deliberately no INSERT policy on `notifications`: a client able to
 * insert here could forge system messages to itself. This runs from the worker.
 */
export interface CreateNotificationArgs {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string | null;
  relatedPaperId?: string | null;
  relatedPaperAnalysisId?: string | null;
}

export async function createNotification(
  db: Db,
  args: CreateNotificationArgs,
): Promise<Notification | null> {
  const result = await db
    .from("notifications")
    .insert({
      user_id: args.userId,
      type: args.type,
      title: args.title,
      body: args.body ?? "",
      href: args.href ?? null,
      related_paper_id: args.relatedPaperId ?? null,
      related_paper_analysis_id: args.relatedPaperAnalysisId ?? null,
    })
    .select()
    .maybeSingle();

  return unwrap(result, "createNotification");
}

/**
 * Whether this exact notification already exists for this analysis.
 *
 * THE DUPLICATE-EMAIL GUARD. Job handlers are required to be idempotent, and
 * the queue retries them after a timeout, a crash, or `fail_job()` backoff.
 * Re-running POST_PROCESSING is harmless for the report — it recomputes and
 * overwrites — but re-running it must not put a second "your review is ready"
 * in someone's inbox. Rows are the natural ledger of what was already sent, so
 * the dispatcher asks here before it writes.
 *
 * Scoped by `(user, type, analysis)` rather than a hash of the content: the
 * body legitimately changes between retries (a score can move if a check
 * succeeded on the second attempt), and the student still only wants one email.
 *
 * Returns false on a read error. Failing open — sending a possible duplicate —
 * beats failing closed and silently swallowing the only email that brings a
 * student back to a finished review.
 */
export async function analysisNotificationExists(
  db: Db,
  args: {
    userId: string;
    type: NotificationType;
    analysisId: string;
    /**
     * Only count notifications created at or after this instant — in practice
     * `paper_analyses.started_at`, which `resetAnalysisForRun` moves forward
     * every time a run begins.
     *
     * Without it the dedupe is "never twice, ever", and re-running an analysis
     * would go silent: the row from the FIRST run suppresses the second, so a
     * student who re-ran after fixing their document would watch it finish and
     * never be told. Scoping to the current run keeps retries quiet (a retried
     * check re-runs POST_PROCESSING within the same run) while letting a
     * genuine re-run speak.
     */
    since?: string | null;
  },
): Promise<boolean> {
  let query = db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", args.userId)
    .eq("type", args.type)
    .eq("related_paper_analysis_id", args.analysisId);

  if (args.since) {
    query = query.gte("created_at", args.since);
  }

  const result = await query;

  if (result.error) {
    console.error("[notifications] dedupe check failed", result.error);
    return false;
  }

  return (result.count ?? 0) > 0;
}

/** Same guard for the events keyed to an upload rather than an analysis. */
export async function paperNotificationExists(
  db: Db,
  args: { userId: string; type: NotificationType; paperId: string },
): Promise<boolean> {
  const result = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", args.userId)
    .eq("type", args.type)
    .eq("related_paper_id", args.paperId);

  if (result.error) {
    console.error("[notifications] dedupe check failed", result.error);
    return false;
  }

  return (result.count ?? 0) > 0;
}

/**
 * When this user was last notified of `type` about this analysis, or null.
 *
 * The dedupe for REPEATABLE events. `analysisNotificationExists` is a hard
 * "never twice", which is right for a completion but wrong for a deadline: a
 * task three days out and the same task overdue are genuinely different news.
 * A timestamp lets the sweep enforce a quiet window instead — nudge, then say
 * nothing for a day — which is the difference between a reminder and nagging.
 */
export async function lastNotifiedAt(
  db: Db,
  args: { userId: string; type: NotificationType; analysisId: string },
): Promise<string | null> {
  const result = await db
    .from("notifications")
    .select("created_at")
    .eq("user_id", args.userId)
    .eq("type", args.type)
    .eq("related_paper_analysis_id", args.analysisId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    // Fail QUIET here, the opposite of `analysisNotificationExists`. An unknown
    // history on a repeatable event should suppress, not send — the cost of a
    // missed nudge is far lower than the cost of a reminder loop.
    console.error("[notifications] recency check failed", result.error);
    return new Date().toISOString();
  }

  return result.data?.created_at ?? null;
}

/**
 * Stamps `emailed_at` once the provider has accepted the message.
 *
 * Written AFTER the send, never before: the column's meaning is "this was
 * actually handed to Resend", which is what makes it usable as the audit trail
 * for "why didn't I get an email". A row with `emailed_at` null and a
 * preference turned on is a delivery bug; the same row with the preference off
 * is the system working.
 */
export async function markNotificationEmailed(
  db: Db,
  notificationId: string,
): Promise<void> {
  const result = await db
    .from("notifications")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (result.error) {
    throw new Error(`markNotificationEmailed: ${result.error.message}`);
  }
}

/**
 * Digest subscribers who are actually due one.
 *
 * SERVICE ROLE — it deliberately crosses users, which is what a sweep is, and
 * `last_digest_sent_at` is not in the `authenticated` column grant.
 *
 * The `or(is.null, lte)` is what makes a never-sent row due: NULL is the
 * starting state for every user, and a plain `lte` comparison would silently
 * exclude all of them, so the digest would go out to nobody and look like a
 * delivery bug rather than a query bug.
 *
 * Backed by the partial index from 20_notification_digest.sql.
 */
export async function listDueDigestSubscribers(
  db: Db,
  sentBefore: string,
  limit = 200,
): Promise<string[]> {
  const result = await db
    .from("notification_preferences")
    .select("user_id")
    .eq("email_weekly_digest", true)
    .or(`last_digest_sent_at.is.null,last_digest_sent_at.lte.${sentBefore}`)
    .limit(limit);

  return unwrap(result, "listDueDigestSubscribers").map((row) => row.user_id);
}

/**
 * Stamps the digest ledger.
 *
 * Written BEFORE the send, unlike `emailed_at`, and the asymmetry is deliberate.
 * The digest has no in-app row to fall back on, so if the stamp came after a
 * send that timed out, the next tick — sixty seconds later — would find the user
 * still due and send again. Stamping first means a failed digest is skipped for
 * a week rather than retried in a loop, and a missed weekly summary is a far
 * cheaper mistake than mailing someone every minute.
 */
export async function markDigestSent(
  db: Db,
  userId: string,
  at = new Date().toISOString(),
): Promise<void> {
  const result = await db
    .from("notification_preferences")
    .update({ last_digest_sent_at: at })
    .eq("user_id", userId);

  if (result.error) {
    throw new Error(`markDigestSent: ${result.error.message}`);
  }
}
