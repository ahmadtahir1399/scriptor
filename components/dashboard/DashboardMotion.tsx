"use client";

import * as React from "react";
import { createTimeline, stagger, type Timeline } from "animejs";
import { createDrawable } from "animejs/svg";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/**
 * The dashboard's entrance, as one piece of choreography.
 *
 * ── Why this is not just `IconMotion on="mount"` on eight icons ──────────
 * Eight independent wrappers would each start their own animation from their
 * own mount, with no shared clock. What you get is eight things twitching in
 * roughly the same second — busier than doing nothing, and it reads as jitter
 * rather than as a screen assembling. This is a single anime.js timeline with
 * absolute positions, so every part knows exactly when the parts before it
 * finished. That is the whole difference between motion and choreography.
 *
 * ── The sequence, and why it is in this order ───────────────────────────
 * It follows how the screen is actually read, not the DOM:
 *
 *   0ms    the cards themselves rise — CSS `.rise-stagger`, not this file
 *   140ms  the icon WELLS arrive, so each tile has a mark before it has a line
 *   200ms  the pine panel's leaf begins a long, slow draw underneath everything
 *   320ms  every glyph draws, cascading in reading order
 *   780ms  the seeds land — the set's full stop, always after its strokes
 *   940ms  the delta chips pop, last, because a delta is a footnote to a number
 *
 * The leaf is deliberately the longest thing on screen at 1.9s: it is 240px of
 * line behind a 30px headline, and drawn at glyph speed it would be a scribble
 * across the panel. Slow, it reads as the panel's ground being laid in.
 *
 * ── Why a wrapper and not a hook in `DashboardContent` ──────────────────
 * `DashboardContent` is an async Server Component and does the whole page's
 * layout. This is the one client leaf on the screen, and it takes the grid as
 * `children` — so the cards, the copy and the data stay server-rendered and
 * this file never learns what a paper is.
 *
 * ── Reduced motion ──────────────────────────────────────────────────────
 * Nothing runs, and nothing needs to: every element here is already in its
 * final state in the server-rendered HTML. This timeline only ever takes
 * something finished and replays it from nothing, which is exactly the case
 * where the correct reduced-motion behaviour is to do nothing at all.
 */

/** Marks the elements this timeline is allowed to touch. */
export type DashboardMotionPart =
  /** The almond icon tile in a stat card. */
  | "well"
  /** A delta or trend chip. */
  | "chip"
  /** The oversized brand leaf behind the pine panel. */
  | "watermark";

/* Transcriptions of `--ease-draw` and `--ease-settle` — see the note in
   `lib/motion/iconGestures.ts`, which owns the same two curves. */
const EASE_DRAW = "cubicBezier(0.22, 1, 0.36, 1)";
const EASE_SETTLE = "cubicBezier(0.34, 1.28, 0.48, 1)";

export function DashboardMotion({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  const host = React.useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) return;

    const root = host.current;
    if (!root) return;

    const find = <T extends Element>(selector: string): T[] =>
      Array.from(root.querySelectorAll<T>(selector));

    const wells = find<HTMLElement>('[data-dash="well"]');
    const chips = find<HTMLElement>('[data-dash="chip"]');
    const watermark = find<SVGSVGElement>('[data-dash="watermark"]');

    /*
     * The watermark is excluded from the cascade and drawn on its own clock —
     * it is a different order of size from the 18px glyphs and cannot share
     * their duration. Its seeds are excluded for the same reason.
     */
    const glyph = 'svg[data-icon]:not([data-dash="watermark"])';
    const strokes = find<SVGPathElement>(`${glyph} [data-draw]`);
    const seeds = find<SVGElement>(`${glyph} [data-seed]`);
    const watermarkStrokes = find<SVGPathElement>(
      '[data-dash="watermark"] [data-draw]',
    );

    const tl: Timeline = createTimeline({ defaults: { ease: EASE_SETTLE } });

    if (wells.length > 0) {
      /*
       * The well turns as it arrives. A pure scale reads as a modal popping
       * open; the few degrees of rotation are what make it read as something
       * being set down on the card.
       */
      tl.add(
        wells,
        {
          opacity: [0, 1],
          scale: [0.6, 1],
          rotate: [-12, 0],
          duration: 620,
          delay: stagger(80),
        },
        140,
      );
    }

    if (watermarkStrokes.length > 0) {
      tl.add(
        createDrawable(watermarkStrokes),
        {
          draw: ["0 0", "0 1"],
          ease: EASE_DRAW,
          duration: 1900,
          delay: stagger(220),
        },
        200,
      );

      /* The leaf fades to the 12% its class already declares. Only opacity and
         scale: `rotate-12` is a Tailwind v4 `rotate` property, and anime writes
         `transform`, so animating rotation here would compose with the class
         and double the angle. */
      tl.add(
        watermark,
        { opacity: [0, 0.12], scale: [1.14, 1], duration: 2200, ease: "outQuart" },
        200,
      );
    }

    if (strokes.length > 0) {
      /*
       * 34ms between glyphs rather than the 55ms a single icon uses. This is a
       * cascade across a whole screen, and at icon spacing the last glyph on
       * the dashboard would still be blank most of a second after the first —
       * which does not read as "about to arrive", it reads as broken.
       */
      tl.add(
        createDrawable(strokes),
        {
          draw: ["0 0", "0 1"],
          ease: EASE_DRAW,
          duration: 680,
          delay: stagger(34),
        },
        320,
      );
    }

    if (seeds.length > 0) {
      tl.add(
        seeds,
        {
          opacity: [0, 1],
          scale: [0.3, 1],
          ease: "outBack",
          duration: 360,
          delay: stagger(45),
        },
        780,
      );
    }

    if (chips.length > 0) {
      tl.add(
        chips,
        {
          opacity: [0, 1],
          scale: [0.82, 1],
          translateY: [5, 0],
          duration: 460,
          delay: stagger(70),
        },
        940,
      );
    }

    return () => {
      tl.revert();
    };
  }, [reduced]);

  /* Renders the grid itself rather than wrapping it — the caller passes the
     bento's own classes through, so this adds no element to the layout. */
  return (
    <div ref={host} className={cn(className)}>
      {children}
    </div>
  );
}
