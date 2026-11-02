"use client";

import * as React from "react";
import { animate } from "animejs";
import { createDrawable } from "animejs/svg";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/**
 * Draws any SVG inside it, once, on mount — powered by anime.js v4.
 *
 * ── Why this shape ───────────────────────────────────────────────────────
 * anime.js is a browser library, so anything importing it is a Client
 * Component. Rather than let that spread, the client boundary is THIS
 * wrapper: it takes already-rendered SVG as `children` and animates the DOM
 * underneath it. The icons stay plain server-rendered SVG, and a page that
 * uses them stays a Server Component.
 *
 * It selects `[data-draw]`, which every `<Stroke>` in the icon set carries —
 * so a new icon is animatable the moment it is drawn, with no registration.
 *
 * ── Why `createDrawable` and not stroke-dasharray by hand ────────────────
 * anime's drawable normalises each path to a 0→1 line and drives it through
 * `draw`, which handles the dash maths, sub-paths and direction for us. Our
 * paths already declare `pathLength={1}`, so the two agree and no path is
 * ever measured at runtime.
 *
 * ── Reduced motion ───────────────────────────────────────────────────────
 * The children are ALREADY the finished artwork — this component only takes
 * something complete and re-plays it from nothing. So when reduced motion is
 * on, the correct behaviour is to do nothing at all, and the icon is simply
 * there. There is no "clamp the duration" path, and no frame where the art is
 * blank. `useReducedMotion` is `useSyncExternalStore`-based, so it is right on
 * the first render rather than one frame late.
 */
export interface DrawOnMountProps {
  children: React.ReactNode;
  /** ms before the draw starts. Use to cascade against a page entrance. */
  delay?: number;
  /** ms per path. */
  duration?: number;
  /** ms between successive paths inside this wrapper. */
  stagger?: number;
  /**
   * Hard ceiling on accumulated stagger, in ms.
   *
   * A plain stagger multiplies by path COUNT, and a path starts at `draw 0 0`
   * — i.e. invisible. Wrap a dozen icons and the last one waits seconds while
   * showing nothing, which does not read as "about to animate", it reads as a
   * missing icon. Past this ceiling every remaining path starts together.
   */
  maxStagger?: number;
  className?: string;
}

export function DrawOnMount({
  children,
  delay = 0,
  duration = 700,
  stagger: staggerMs = 55,
  maxStagger = 420,
  className,
}: DrawOnMountProps) {
  const host = React.useRef<HTMLSpanElement | null>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) return;

    const root = host.current;
    if (!root) return;

    const targets = root.querySelectorAll<SVGPathElement>("[data-draw]");
    if (targets.length === 0) return;

    /*
     * Seeds and fills are NOT drawable — they should land at the end rather
     * than be traced. They fade in on the tail of the last stroke, which is
     * what makes the dot read as a full stop.
     */
    const marks = root.querySelectorAll<SVGElement>(
      "circle[fill='currentColor'], [data-seed]",
    );

    /* Bounded stagger — see `maxStagger`. anime types the callback index as
       optional, so it is defaulted rather than asserted. */
    const stepFor = (i: number | undefined) =>
      delay + Math.min((i ?? 0) * staggerMs, maxStagger);

    const drawn = animate(createDrawable(targets), {
      draw: ["0 0", "0 1"],
      ease: "outQuart",
      duration,
      delay: (_el, i) => stepFor(i),
    });

    const landed =
      marks.length > 0
        ? animate(marks, {
            opacity: [0, 1],
            scale: [0.4, 1],
            ease: "outBack",
            duration: 380,
            // Lands just after its own icon's strokes, not after ALL of them.
            delay: (_el, i) => stepFor(i) + duration * 0.55,
          })
        : null;

    return () => {
      drawn.revert();
      landed?.revert();
    };
  }, [reduced, delay, duration, staggerMs, maxStagger]);

  return (
    <span ref={host} className={cn("contents", className)}>
      {children}
    </span>
  );
}
