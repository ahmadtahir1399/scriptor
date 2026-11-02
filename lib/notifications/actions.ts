"use server";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  countUnreadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/db/queries/notifications";
import { notificationTone } from "@/lib/domain/notification";
import type { NotificationType } from "@/lib/db/enums";

/**
 * The notification feed's server actions.
 *
 * ── EVERY ONE OF THESE RUNS ON THE USER'S SESSION CLIENT ─────────────────────
 *
 * Never the admin client. `15_rls.sql` grants `authenticated` exactly
 * `select`, `delete`, and `update (read_at)` on `notifications`, with an
 * `is_owner(user_id)` policy on each — so RLS, not the code below, is what
 * guarantees a user can only ever read and mark their own. There is no INSERT
 * grant at all, which is why creation lives in the worker under the service
 * role: a client that could insert here could forge system messages to itself.
 *
 * The actions therefore pass no user id to the queries. Filtering by
 * `eq("user_id", …)` in application code would look more careful and be
 * strictly worse — it reads as though *that* were the security boundary, and
 * the day someone removes it nothing appears to change.
 */

/** The shape the popover renders. Deliberately not the raw table row. */
export interface NotificationFeedItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
  /** Resolved server-side so the client never re-derives the colour contract. */
  tone: "primary" | "verified" | "warning" | "critical";
}

export interface NotificationFeed {
  items: NotificationFeedItem[];
  unreadCount: number;
}

/** How many the popover holds. Nobody scrolls a bell menu to page four. */
const FEED_LIMIT = 20;

export async function getNotificationFeed(): Promise<NotificationFeed> {
  // Called for the auth gate, not for the id — see the header note on why RLS
  // rather than an application-side filter is the boundary here.
  await requireSessionUser();

  const db = await createClient();
  const [rows, unreadCount] = await Promise.all([
    listNotifications(db, FEED_LIMIT),
    // Counted separately rather than derived from `rows`, because the feed is
    // capped: a user with 30 unread would otherwise see the badge stop at 20
    // and quietly under-report. Head-only count, backed by
    // `notifications_unread_idx`.
    countUnreadNotifications(db),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      createdAt: row.created_at,
      readAt: row.read_at,
      tone: notificationTone(row.type),
    })),
    unreadCount,
  };
}

export type NotificationActionResult = { ok: true } | { ok: false; error: string };

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  try {
    await requireSessionUser();
    const db = await createClient();
    await markNotificationRead(db, notificationId);
    return { ok: true };
  } catch (error) {
    // A failed mark-as-read is a cosmetic failure — the notification is still
    // there and still readable. Reported so the client can roll its optimistic
    // update back, never thrown into an error boundary over a badge count.
    console.error("[notifications] markRead failed", error);
    return { ok: false, error: "Could not mark that as read." };
  }
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  try {
    await requireSessionUser();
    const db = await createClient();
    await markAllNotificationsRead(db);
    return { ok: true };
  } catch (error) {
    console.error("[notifications] markAllRead failed", error);
    return { ok: false, error: "Could not mark those as read." };
  }
}

/**
 * Dismisses one notification for good.
 *
 * A real DELETE rather than a soft `dismissed_at`, because `15_rls.sql` grants
 * `authenticated` exactly `select`, `delete` and `update (read_at)` — there is
 * no column to soft-delete into, and adding one would mean widening the update
 * grant on a table the user is otherwise not allowed to write.
 *
 * Worth knowing: rows are also the ledger the dedupe guards in
 * `queries/notifications.ts` read, so deleting one re-arms it. In practice that
 * costs nothing — the guard only matters while a job is still being retried,
 * and a user dismissing a notice they have already seen is telling us the
 * event is done with. It is not a reason to keep the row.
 */
export async function deleteNotificationAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  try {
    await requireSessionUser();
    const db = await createClient();
    await deleteNotification(db, notificationId);
    return { ok: true };
  } catch (error) {
    console.error("[notifications] delete failed", error);
    return { ok: false, error: "Could not delete that notification." };
  }
}
