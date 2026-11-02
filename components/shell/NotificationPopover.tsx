"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/EmptyState";
import { useNotifications } from "@/hooks/useNotifications";
import { IconBell, IconTrash } from "@/components/icons";
import {
  IconMotion,
  useIconMotion,
  type IconMotionHandle,
} from "@/components/motion/IconMotion";
import type { NotificationFeedItem } from "@/lib/notifications/actions";

/**
 * The notification bell and its popover.
 *
 * ── THE UNREAD MARK IS A DOT *AND* A WORD ────────────────────────────────────
 *
 * Read and unread are distinguished by a tone dot, a heavier title weight, and
 * an `sr-only` "Unread" label. The colour is never the only carrier — same
 * contract as everywhere else in the app, and it matters more here than most
 * places because the dot is 6px.
 *
 * ── THE TONE DOT IS NOT A STATUS PILL ────────────────────────────────────────
 *
 * `notificationTone()` maps the type to the semantic palette, and the dot is a
 * SOLID accent sitting beside a text title that already says what happened —
 * which is exactly the "thin accents" use the design contract permits. What it
 * is not is a `primary` badge standing in for state: REQUIREMENTS_EXTRACTED
 * resolves to `primary` because it is a system notice, not because it passed.
 *
 * ── THE BELL RINGS ON ARRIVAL, NOT ON CHANGE ─────────────────────────────────
 *
 * The feed polls once a minute, so the badge can appear while the user is
 * reading something else — the ring is what makes that legible without them
 * having to watch the corner. It fires only when the unread count goes UP: a
 * bell that also rings as items are marked read is celebrating the user's own
 * click, and one that rings on mount is announcing the page rather than news.
 */
export function NotificationPopover() {
  const t = useTranslations("shell.notifications");
  const [open, setOpen] = React.useState(false);
  const { feed, isLoading, markRead, markAllRead, remove, refresh } =
    useNotifications();
  const bell = React.useRef<IconMotionHandle>(null);

  // Refetch as the popover opens, so what the user is about to read is current
  // even if the one-minute poll last ran fifty seconds ago.
  const onOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) refresh();
    },
    [refresh],
  );

  const { items, unreadCount } = feed;

  /*
   * Seeded with the count at mount, so an inbox that already had three unread
   * items when the page loaded does not ring. The comparison lives in an
   * effect rather than in render because a ref written during render is a lie
   * under concurrent rendering — a discarded render would consume the arrival
   * and the committed one would stay silent.
   */
  const seenUnread = React.useRef(unreadCount);
  React.useEffect(() => {
    if (unreadCount > seenUnread.current) bell.current?.play();
    seenUnread.current = unreadCount;
  }, [unreadCount]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("label")}
        >
          {/* `within` walks up to the button, so the whole hit area rings the
              bell rather than only the 20px glyph inside it. */}
          <IconMotion within="button" ref={bell}>
            <IconBell aria-hidden="true" />
          </IconMotion>
          {unreadCount > 0 ? (
            <Badge
              variant="critical"
              /*
               * Keyed by the count so React replaces the node — and therefore
               * restarts `.pop` — every time the number changes. Without the
               * key it is the same element with new text, and the badge would
               * only ever animate the first time it appeared.
               */
              key={unreadCount}
              className="pop absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center px-1 tabular-nums"
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
          {/*
           * The badge is aria-hidden and the count is announced here instead.
           * "9+" is a visual truncation; a screen reader should hear the real
           * number, and hear "No unread notifications" rather than silence.
           */}
          <span className="sr-only">{t("unread", { count: unreadCount })}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 max-w-[calc(100vw-1.5rem)]">
        <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-section-title text-ink">{t("title")}</p>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="text-meta text-primary rounded-sm underline underline-offset-2 hover:no-underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {t("markAllRead")}
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={IconBell}
            title={isLoading ? t("loadingTitle") : t("emptyTitle")}
            description={isLoading ? undefined : t("emptyDescription")}
            className="py-8"
          />
        ) : (
          /*
           * The rows assemble in order. `.rise-stagger` keys its delay off
           * `--i`, and because each row is keyed by notification id, marking
           * one read updates it in place rather than remounting it — so the
           * stagger plays when the popover opens and never again while it is
           * being used.
           */
          <ul className="rise-stagger scroll-hidden max-h-80 overflow-y-auto">
            {items.map((item, index) => (
              <NotificationRow
                key={item.id}
                item={item}
                index={index}
                onRead={markRead}
                onDelete={remove}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Solid tone accents — a thin dot beside a label, never a colour-only signal. */
const DOT_TONE: Record<NotificationFeedItem["tone"], string> = {
  primary: "bg-primary",
  verified: "bg-verified",
  warning: "bg-warning",
  critical: "bg-critical",
};

function NotificationRow({
  item,
  index,
  onRead,
  onDelete,
  onNavigate,
}: {
  item: NotificationFeedItem;
  /** Position in the feed — feeds the `.rise-stagger` delay. */
  index: number;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: () => void;
}) {
  const t = useTranslations("shell.notifications");
  const format = useFormatter();
  const unread = item.readAt === null;

  // The hook rather than `<IconMotion>`: the ref goes straight on the button,
  // so the bin's lid lifts on hover without a wrapper span inside a control
  // that is already sized as a grid of exactly one glyph.
  const { ref: binRef } = useIconMotion<HTMLButtonElement>();

  const inner = (
    <>
      <span className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-1.5 size-1.5 shrink-0 rounded-full",
            unread ? DOT_TONE[item.tone] : "bg-border",
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "text-body block",
              unread ? "text-ink font-medium" : "text-muted",
            )}
          >
            {unread ? <span className="sr-only">{t("unreadItem")} </span> : null}
            {item.title}
          </span>
          {item.body ? (
            <span className="text-meta text-muted mt-0.5 block">
              {item.body}
            </span>
          ) : null}
          <time
            dateTime={item.createdAt}
            className="text-micro text-muted mt-1 block"
          >
            {/*
             * Formatted against the `now` that `i18n/request.ts` pins per
             * request, NOT against a fresh clock — that pinning is what stops a
             * timestamp near a unit boundary rendering "2 minutes ago" on the
             * server and "3 minutes ago" on the client.
             */}
            {format.relativeTime(new Date(item.createdAt))}
          </time>
        </span>
      </span>
    </>
  );

  // `pr-11` reserves the delete button's column. The row keeps its full width
  // and stays the whole hit area — the text just stops before the bin.
  //
  // The hover tint moved up to the `<li>` when the bin became a sibling:
  // hovering the bin would otherwise drop the row's highlight, so the pointer
  // would appear to leave a row it is still inside.
  const className = cn(
    "focus-visible:ring-primary block w-full py-3 pr-11 pl-4 text-left focus-visible:ring-2 focus-visible:outline-none",
  );

  return (
    <li
      className="border-border hover:bg-bg group relative border-b last:border-b-0"
      style={{ "--i": index } as React.CSSProperties}
    >
      {item.href ? (
        <Link
          href={item.href}
          className={className}
          onClick={() => {
            onRead(item.id);
            onNavigate();
          }}
        >
          {inner}
        </Link>
      ) : (
        // No deep link — the row is still the mark-as-read control, so it stays
        // a real button rather than a div with a click handler.
        <button type="button" className={className} onClick={() => onRead(item.id)}>
          {inner}
        </button>
      )}

      {/*
       * A SIBLING of the row, not a child of it. The row is an anchor, and an
       * interactive element nested inside an anchor is invalid HTML that
       * browsers resolve by guessing — which here would mean deleting the
       * notification AND navigating to it.
       *
       * Revealed on hover from `md` up, permanently visible below it: hover is
       * the right amount of restraint for a pointer, and no affordance at all
       * on a touch device where `:hover` never fires. `group-focus-within`
       * covers the keyboard, so tabbing into the row surfaces the bin the same
       * way a pointer does.
       *
       * No confirmation step. Deleting a notification discards a notice about
       * work, never the work — the paper, the analysis and the report are all
       * untouched — so a dialog here would be ceremony over nothing. That is
       * exactly the opposite call from `DeletePaperDialog`, which guards
       * something unrecoverable.
       */}
      <button
        type="button"
        ref={binRef}
        onClick={() => onDelete(item.id)}
        aria-label={t("delete")}
        className={cn(
          "text-muted hover:bg-critical-soft hover:text-critical focus-visible:ring-critical absolute top-2.5 right-2 grid size-7 place-items-center rounded-sm transition focus-visible:ring-2 focus-visible:outline-none",
          "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        )}
      >
        <IconTrash size={15} />
      </button>
    </li>
  );
}
