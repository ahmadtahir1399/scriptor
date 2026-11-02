import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The base every Scriptor icon is drawn on.
 *
 * ── Why we draw our own ──────────────────────────────────────────────────
 * Lucide is excellent and completely anonymous. An icon set is the highest
 * density of brand per pixel in an interface — twenty glyphs repeated on every
 * screen — and a stock set means the app can be mistaken for any other app
 * using the same one. These are ours.
 *
 * ── The rules that make them a SET and not twenty drawings ───────────────
 *  · 24×24 grid, 2px optical padding, so glyphs sit on a 20px live area.
 *  · 1.6 stroke, round caps AND round joins. Never a mitre — a sharp corner
 *    reads as technical, and this palette is not.
 *  · Curves over straights wherever the subject allows. A leaf, a page corner
 *    and a chart line are all drawn with the same easing of the hand.
 *  · A recurring SEED: a single filled 1.1r dot marking the "live" point of an
 *    icon — the tick's origin, the gauge's needle, the alert's stop. It is the
 *    signature that ties the set together, and it is always `currentColor`.
 *  · Every stroked path carries `pathLength={1}` and `data-draw`, so the whole
 *    set is animatable by `DrawOnMount` without measuring anything.
 *
 * ── Server-safe ──────────────────────────────────────────────────────────
 * These are plain SVG with no hooks, so they render inside Server Components.
 * Animation is opt-in by WRAPPING them in `<DrawOnMount>` or `<IconMotion>`,
 * which are the only client boundaries — the icons themselves never force one.
 */

/**
 * Every glyph in the set, by name.
 *
 * This union is the icon set's vocabulary, and it exists so a glyph can be
 * identified from the DOM rather than from a component reference. `Icon`
 * writes it out as `data-icon`, and `lib/motion/iconGestures` maps it to the
 * motion that glyph should perform.
 *
 * ── Why a string on the element and not a lookup on the component ────────
 * Half the call sites in the app take an icon as an opaque
 * `React.ComponentType<IconProps>` prop — `StatTile`, `EmptyState`, the
 * sidebar's nav config — so by the time anything wants to animate one, the
 * identity of the component is either gone or unusable across the
 * server/client boundary. A `Map` keyed by component reference would also drag
 * the entire barrel into every bundle that wants one gesture, and a lookup
 * keyed by `Icon.name` breaks the moment a minifier mangles it.
 *
 * A tag on the rendered element survives all three: `IconMotion` already has
 * the DOM node in hand, so it reads the answer off the thing it is animating.
 */
export type IconGlyph =
  | "leaf"
  | "dashboard"
  | "library"
  | "upload"
  | "requirements"
  | "settings"
  | "score"
  | "findings"
  | "drafts"
  | "trend"
  | "sprout"
  | "alert"
  | "activity"
  | "flask"
  | "users"
  | "check"
  | "close"
  | "arrow-right"
  | "chevron-down"
  | "chevron-up-down"
  | "search"
  | "menu"
  | "panel"
  | "bell"
  | "user"
  | "sign-out"
  | "spinner"
  | "plus"
  | "minus"
  | "refresh"
  | "pencil"
  | "trash"
  | "download"
  | "link"
  | "send"
  | "play"
  | "skip"
  | "more"
  | "ai"
  | "info"
  | "check-circle"
  | "file-question"
  | "idea"
  | "inbox"
  | "mail-check"
  | "mic"
  | "thumb-up"
  | "thumb-down"
  | "graduation"
  | "history"
  | "chevron-left"
  | "chevron-up"
  | "clock";

export interface IconProps extends Omit<React.ComponentProps<"svg">, "children"> {
  /** Rendered size in px. The grid scales with it. */
  size?: number;
  /** Stroke weight on the 24 grid. Rarely overridden. */
  weight?: number;
  children?: React.ReactNode;
}

/** What each glyph in the set passes down. Callers never set this. */
interface IconBaseProps extends IconProps {
  glyph: IconGlyph;
}

export function Icon({
  size = 20,
  weight = 1.6,
  className,
  children,
  glyph,
  ...props
}: IconBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={glyph}
      className={cn("shrink-0", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/**
 * A stroked path in the set.
 *
 * `pathLength={1}` normalises every path to a length of 1 regardless of its
 * real geometry, which is what lets one animation config draw any icon without
 * a DOM measurement. `data-draw` is the hook `DrawOnMount` selects on.
 *
 * `accent` marks the ONE path that carries the glyph's meaning — the tick in a
 * checked requirement, the needle on the score gauge, the arrowhead on a
 * refresh loop. A gesture that wants to say a single thing ("this passed")
 * animates the accent alone; without one it falls back to the whole glyph.
 * Most icons have no accent, and that is correct: an icon whose every stroke
 * matters equally should move as one shape.
 */
export function Stroke({
  d,
  accent,
  ...props
}: React.ComponentProps<"path"> & { accent?: boolean }) {
  return (
    <path
      d={d}
      pathLength={1}
      data-draw=""
      data-accent={accent ? "" : undefined}
      {...props}
    />
  );
}

/**
 * The seed — the set's signature mark.
 *
 * Filled, unstroked, and deliberately NOT drawable: it should land at the end
 * of a draw rather than being traced, which is what makes it read as a full
 * stop rather than another line. `data-seed` is what motion selects on;
 * matching `circle[fill='currentColor']` also works but would catch any future
 * filled circle that is not a seed.
 */
export function Seed({ cx, cy, r = 1.1 }: { cx: number; cy: number; r?: number }) {
  return (
    <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" data-seed="" />
  );
}
