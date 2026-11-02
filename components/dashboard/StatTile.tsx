import * as React from "react";

import { cn } from "@/lib/utils";
import type { IconProps } from "@/components/icons";
import { IconMotion } from "@/components/motion/IconMotion";
import { Card, CardContent } from "@/components/ui/card";

/**
 * One number in the dashboard's stat row.
 *
 * The value is display type (Fraunces) because a stat IS the message on this
 * screen; the label beneath it is sans, because a label is chrome. That split
 * is the whole reason the app carries two of our own faces.
 *
 * ── The count-up contract ────────────────────────────────────────────────
 * `.count-up` renders its digits through `::after`, which assistive tech does
 * not reliably announce. So the visible copy is `aria-hidden` and the true
 * value is emitted again in an `sr-only` span. Every caller of `.count-up`
 * owes this; see the note in `globals.css`.
 *
 * `countUp` is opt-out because not every value is a number — "—" cannot be
 * animated by a counter, and a score of `null` must render as absent rather
 * than as a zero that counts up to nothing.
 *
 * ── Hovering the tile moves the glyph, not the other way round ───────────
 * The tile is 200px of card and the icon is 18px of it, so a gesture bound to
 * the icon would almost never fire. `within` puts the listener on the card and
 * the WELL takes a CSS-only nudge at the same time — two scales of response to
 * one hover, which is what stops the tile feeling like a static receipt.
 *
 * The tile stays a Server Component: `IconMotion` is the client leaf, and the
 * well's scale is a Tailwind `group-hover`, not JavaScript.
 */
export interface StatTileProps {
  label: string;
  /** The number to animate to. Null renders an em-dash and no animation. */
  value: number | null;
  /** Appended to the value, e.g. a percent sign. Not animated. */
  suffix?: string;
  icon: React.ComponentType<IconProps>;
  /** Pre-formatted, already-translated delta text, e.g. "+6 since v1". */
  delta?: string;
  trend?: "up" | "down" | "flat";
  /** Position in the row — feeds the `.rise-stagger` delay. */
  index?: number;
  className?: string;
}

const TREND_CHIP: Record<"up" | "down" | "flat", string> = {
  up: "bg-verified-soft text-verified",
  down: "bg-critical-soft text-critical",
  flat: "bg-primary-soft text-muted",
};

export function StatTile({
  label,
  value,
  suffix,
  icon: Icon,
  delta,
  trend = "flat",
  index = 0,
  className,
}: StatTileProps) {
  const hasValue = value !== null;

  return (
    <Card
      /*
       * No border and no left rule — see the note in `DashboardContent` on why
       * the dashboard's cards carry neither. `border-transparent` rather than
       * `border-0`: the 1px stays in the box so the tile does not shift by a
       * pixel when the hover border arrives.
       *
       * `hover:border-primary/35` matches the bento tiles on the landing page,
       * which pick up a pine edge on hover rather than only lifting.
       */
      className={cn(
        "lift group relative overflow-hidden border-transparent hover:border-primary/35",
        className,
      )}
      style={{ "--i": index } as React.CSSProperties}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          {/*
           * Icon tile. Almond well + pine glyph: structural, not a status.
           *
           * `data-dash="well"` hands it to the dashboard's entrance timeline;
           * the hover scale stays CSS, because a hover has to answer on the
           * frame it happens and has no business waiting on a JS clock.
           */}
          <span
            aria-hidden="true"
            data-dash="well"
            className="bg-primary-soft text-primary ease-out-quiet flex size-9 shrink-0 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-[1.08]"
          >
            <IconMotion within="[data-slot=card]">
              <Icon className="size-4.5" strokeWidth={1.75} />
            </IconMotion>
          </span>

          {delta ? (
            <span
              data-dash="chip"
              className={cn(
                "rounded-sm px-2 py-0.5 text-micro font-medium whitespace-nowrap",
                TREND_CHIP[trend],
              )}
            >
              {delta}
            </span>
          ) : null}
        </div>

        {/*
         * Pine rather than espresso, matching the landing tiles' `display
         * text-primary` headings and the page title above it. A stat value is
         * display type, not a status, so this spends the identity where
         * `globals.css` asks for it without making pine mean "good": all four
         * tiles are pine whatever they read.
         */}
        <p className="display text-primary mt-4 text-[30px] leading-none tabular-nums">
          {hasValue ? (
            <>
              <span
                aria-hidden="true"
                className="count-up"
                style={{ "--count-to": value } as React.CSSProperties}
              />
              {suffix ? <span aria-hidden="true">{suffix}</span> : null}
              <span className="sr-only">
                {value}
                {suffix}
              </span>
            </>
          ) : (
            <span className="text-muted-soft">—</span>
          )}
        </p>

        <p className="text-meta text-muted mt-1.5">{label}</p>
      </CardContent>
    </Card>
  );
}
