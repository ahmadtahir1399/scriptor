"use client";

import * as React from "react";

import { SCROLL, type DriftDepth } from "@/lib/constants";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { gsap } from "@/lib/motion/gsap";

interface DriftProps {
  /**
   * How far this element travels against the scroll. `far` and `mid` move
   * upward as the page descends; `near` moves with it. The opposition is what
   * reads as depth — a set of elements all drifting the same way just reads as
   * the page scrolling at the wrong speed.
   */
  depth?: DriftDepth;
  /**
   * Where the drift range begins.
   *
   * `enter` — the element scrolls in from below. Progress starts as its top
   * crosses the viewport bottom.
   *
   * `top` — the element is already on screen at page load. Progress starts at
   * scroll zero. Getting this wrong is visible: an above-the-fold element on
   * the `enter` range is already part-way through its travel on first paint,
   * so it renders visibly displaced from where it was authored.
   */
  anchor?: "enter" | "top";
  className?: string;
  children: React.ReactNode;
}

/**
 * Scroll-linked vertical drift. The one thing CSS genuinely cannot do here:
 * `animation-timeline: scroll()` is still Chromium-only, so this is the case
 * that earns its client bundle.
 *
 * Under reduced motion no ScrollTrigger is created, so the element renders at
 * its natural position and the layout is simply static. The neutral position
 * is the authored one — there is no "end state" to restore, which is why this
 * needs no equivalent of the `.arc-draw` static fallback.
 */
export function Drift({
  depth = "mid",
  anchor = "enter",
  className,
  children,
}: DriftProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    // gsap.context() scopes every tween and ScrollTrigger created inside it,
    // so a single revert() on unmount removes both. Killing the tween alone
    // would leave its ScrollTrigger listening against a detached node.
    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: SCROLL.depth[depth] * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: anchor === "top" ? "top top" : "top bottom",
          end: "bottom top",
          scrub: SCROLL.scrub,
        },
      });
    });

    return () => ctx.revert();
  }, [depth, anchor, reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
