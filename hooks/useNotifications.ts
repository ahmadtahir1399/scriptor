"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteNotificationAction,
  getNotificationFeed,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationFeed,
} from "@/lib/notifications/actions";

/**
 * The notification bell's data.
 *
 * ── WHY THIS POLLS INSTEAD OF SUBSCRIBING ────────────────────────────────────
 *
 * Every other live surface in the app uses Realtime, so the absence here is
 * deliberate. `16_storage_realtime.sql` publishes EXACTLY three tables and says
 * why: "every table in the publication costs WAL decoding work on every write".
 * `notifications` is not one of them, and adding it would mean a migration
 * against a documented decision to buy latency on an event that took the worker
 * several minutes to produce in the first place.
 *
 * So the freshness comes from the three moments that actually matter:
 *
 *   1. ON OPEN — the popover refetches when it is opened, so what the user is
 *      looking at is never stale.
 *   2. ON FOCUS — returning to the tab refetches, which covers the common case
 *      of leaving Scriptor open while an analysis runs.
 *   3. A SLOW INTERVAL — so the badge appears on a tab left open and untouched.
 *
 * The interval is one minute, matching the worker's own cron: polling faster
 * than notifications can possibly be created is pure load.
 */

const QUERY_KEY = ["notifications"] as const;
const POLL_INTERVAL_MS = 60_000;

const EMPTY: NotificationFeed = { items: [], unreadCount: 0 };

export interface NotificationsValue {
  feed: NotificationFeed;
  isLoading: boolean;
  /** Marks one read, optimistically. Safe to call on an already-read item. */
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Deletes one, optimistically. Permanent — there is no undo surface. */
  remove: (id: string) => void;
  /** Call when the popover opens, to refetch what the user is about to read. */
  refresh: () => void;
}

export function useNotifications(): NotificationsValue {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getNotificationFeed,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    // The bell is chrome on every page. A failed fetch should leave it looking
    // empty and quiet, not retry in a tight loop or surface an error over the
    // page the user is actually reading.
    retry: 1,
    staleTime: 15_000,
  });

  const feed = data ?? EMPTY;

  const markRead = React.useCallback(
    (id: string) => {
      const previous = queryClient.getQueryData<NotificationFeed>(QUERY_KEY);
      // Already read: nothing to do, and skipping avoids a pointless write on
      // every click-through to a notification the user has opened before.
      if (previous?.items.find((item) => item.id === id)?.readAt) return;

      queryClient.setQueryData<NotificationFeed>(QUERY_KEY, (current) =>
        current ? applyRead(current, id) : current,
      );

      void markNotificationReadAction(id).then((result) => {
        // Roll back rather than leave the badge lying. The count is the only
        // thing telling the user there is something to look at.
        if (!result.ok && previous) {
          queryClient.setQueryData(QUERY_KEY, previous);
        }
      });
    },
    [queryClient],
  );

  const markAllRead = React.useCallback(() => {
    const previous = queryClient.getQueryData<NotificationFeed>(QUERY_KEY);
    if (!previous || previous.unreadCount === 0) return;

    const now = new Date().toISOString();
    queryClient.setQueryData<NotificationFeed>(QUERY_KEY, {
      items: previous.items.map((item) => ({
        ...item,
        readAt: item.readAt ?? now,
      })),
      unreadCount: 0,
    });

    void markAllNotificationsReadAction().then((result) => {
      if (!result.ok) queryClient.setQueryData(QUERY_KEY, previous);
    });
  }, [queryClient]);

  /*
   * Deliberately does NOT refetch on success. The feed is capped at 20, so a
   * refetch would pull row 21 up into the gap — the list would grow a new item
   * at the bottom at the exact moment the user deleted one, which reads as the
   * delete having failed. The next poll fills the gap a minute later, when
   * nobody is attributing it to their own click.
   */
  const remove = React.useCallback(
    (id: string) => {
      const previous = queryClient.getQueryData<NotificationFeed>(QUERY_KEY);
      if (!previous?.items.some((item) => item.id === id)) return;

      queryClient.setQueryData<NotificationFeed>(QUERY_KEY, applyDelete(previous, id));

      void deleteNotificationAction(id).then((result) => {
        // Put the row back rather than leave a hole the user believes is gone.
        // Restores `previous` wholesale, not just the one item, so the row
        // returns to its original position instead of the end of the list.
        if (!result.ok) queryClient.setQueryData(QUERY_KEY, previous);
      });
    },
    [queryClient],
  );

  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  return { feed, isLoading, markRead, markAllRead, remove, refresh };
}

function applyRead(feed: NotificationFeed, id: string): NotificationFeed {
  return {
    items: feed.items.map((item) =>
      item.id === id && !item.readAt
        ? { ...item, readAt: new Date().toISOString() }
        : item,
    ),
    // Floored at zero: the feed is capped at 20 while the count is not, so the
    // two can legitimately disagree, and a negative badge is worse than a
    // slightly stale one.
    unreadCount: Math.max(0, feed.unreadCount - 1),
  };
}

function applyDelete(feed: NotificationFeed, id: string): NotificationFeed {
  const removed = feed.items.find((item) => item.id === id);

  return {
    items: feed.items.filter((item) => item.id !== id),
    // Only an UNREAD row was ever counted in the badge, so deleting a read one
    // must leave the number alone — decrementing on every delete is how a
    // badge ends up at zero with three unread items still in the list.
    unreadCount:
      removed && !removed.readAt
        ? Math.max(0, feed.unreadCount - 1)
        : feed.unreadCount,
  };
}
