"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { IconChevronLeft, IconChevronDown } from "@/components/icons";

/**
 * The calendar, built on react-day-picker.
 *
 * ── Why it is hand-themed rather than pasted from shadcn ─────────────────
 * shadcn's `calendar.tsx` targets react-day-picker v9 and ships a palette of
 * its own (`bg-accent`, `text-primary-foreground`, hard-coded `rounded-md`).
 * This project is on **v10**, whose `classNames` keys changed, and the token
 * rule says a component may not carry a colour that isn't in `globals.css`.
 * So the primitive is v10's `DayPicker` and every class below resolves to a
 * Scriptor token — it cannot render an unapproved colour.
 *
 * ── The shapes ───────────────────────────────────────────────────────────
 * Days are circles, not rounded squares: the app's control language is the
 * capsule, and a grid of 40px squares fights every other surface on screen.
 * The selected day is a solid pine disc; today is marked by a honey seed under
 * the numeral rather than a ring, so "today" and "selected" can both be true
 * without two rings stacking.
 *
 * Navigation chevrons come from our own icon set, so the calendar matches the
 * rest of the app rather than importing lucide back in through the side door.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3", className)}
      classNames={{
        /*
         * `relative` on the ROOT is load-bearing. In v10 `Nav` is a child of
         * `Root` and a SIBLING of `Months` — not of the caption — so an
         * absolutely-positioned nav with no positioned ancestor here escapes
         * the calendar entirely and pins its arrows to the page corners.
         */
        root: "relative",
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-3",

        // Caption row: month label centred, arrows pinned to the edges.
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-body text-ink font-medium",

        nav: "absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between px-0.5",
        button_previous: cn(
          "text-muted hover:bg-primary-soft/60 hover:text-ink inline-flex size-8 items-center justify-center rounded-full",
          "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        ),
        button_next: cn(
          "text-muted hover:bg-primary-soft/60 hover:text-ink inline-flex size-8 items-center justify-center rounded-full",
          "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        ),

        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-soft eyebrow flex-1 pb-1.5 text-center normal-case",

        weeks: "flex flex-col gap-1",
        week: "flex w-full",

        day: "flex-1 p-0 text-center",
        day_button: cn(
          "text-body text-ink mx-auto inline-flex size-9 items-center justify-center rounded-full tabular-nums",
          "transition-[background-color,color] duration-150",
          "hover:bg-primary-soft/70",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-35",
        ),

        // Solid pine disc. The foreground token is warm off-white, not #fff.
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary-hover [&>button]:font-medium",

        /*
         * Today is a honey seed UNDER the numeral, not a ring — a ring would
         * collide with the selected disc whenever today is also the selection.
         * Honey is decorative here and never the only signal: the numeral is
         * still the value.
         */
        today:
          "relative [&>button]:font-medium after:bg-decor after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full",

        outside: "[&>button]:text-muted-soft [&>button]:opacity-45",
        disabled: "[&>button]:opacity-35",
        hidden: "invisible",

        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass, ...rest }) => {
          const Glyph =
            orientation === "left" ? IconChevronLeft : IconChevronDown;
          return (
            <Glyph
              size={16}
              className={cn(
                chevronClass,
                orientation === "right" && "-rotate-90",
                orientation === "up" && "rotate-180",
              )}
              {...rest}
            />
          );
        },
      }}
      {...props}
    />
  );
}
