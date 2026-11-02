"use client";

import * as React from "react";

import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { gsap } from "@/lib/motion/gsap";

/**
 * Drives the hero specimen's sequence.
 *
 * A wrapper rather than a client rewrite of the card: `AnchoredSpecimen` stays
 * a Server Component and this selects its `data-motion` hooks by ref. The copy
 * and its translations never enter the client bundle — only this timeline does.
 *
 * The sequence IS the product's argument, in order: the page is read, a phrase
 * is caught, the finding attaches to that phrase. Playing it as one orchestrated
 * pass rather than a set of independent entrances is the whole point — scattered
 * fades would say nothing.
 *
 * It plays ONCE, on load, and then the card simply sits there being readable.
 * A looping hero demo pulls the eye back every few seconds while someone is
 * trying to read the headline next to it, which is the opposite of what a hero
 * is for.
 */

/*
 * useLayoutEffect on the client, useEffect on the server.
 *
 * The markup renders in its FINISHED state, so the timeline's opening `set()`
 * has to land before the browser paints. In a plain useEffect it lands after,
 * and the card flashes complete for one frame before jumping back to the start.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function SpecimenMotion({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.35 });

      tl.from('[data-motion="card"]', {
        y: 18,
        opacity: 0,
        duration: 0.62,
        ease: "power3.out",
      })
        // `:not([data-motion="pill"])` matters. The pill is a child of the
        // strip and has its own tween later in this timeline; without the
        // exclusion both tweens own its opacity, the later `from` re-zeroes
        // what the stagger already resolved, and the pill can be left invisible.
        .from(
          '[data-motion="strip"] > :not([data-motion="pill"])',
          { opacity: 0, duration: 0.3, stagger: 0.06, ease: "power2.out" },
          "-=0.3",
        )
        // The reading pass: a sage band travelling the height of the quote.
        .fromTo(
          '[data-motion="scan"]',
          { yPercent: -100, opacity: 0 },
          {
            yPercent: 320,
            opacity: 1,
            duration: 1.15,
            ease: "power1.inOut",
          },
          "-=0.1",
        )
        .to('[data-motion="scan"]', { opacity: 0, duration: 0.25 }, "-=0.3")
        // The catch. scaleX from the left, so the wash lays down across the
        // phrase the way a marker would rather than fading up under it.
        .fromTo(
          '[data-motion="highlight"]',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.42, ease: "power2.out" },
          "-=0.55",
        )
        .from(
          '[data-motion="pill"]',
          { scale: 0.82, opacity: 0, duration: 0.34, ease: "back.out(2)" },
          "-=0.2",
        )
        // The finding attaches: rule draws down first, text follows it.
        .fromTo(
          '[data-motion="rule"]',
          { scaleY: 0 },
          { scaleY: 1, duration: 0.4, ease: "power2.out" },
          "-=0.1",
        )
        .from(
          '[data-motion="finding"] > :not([data-motion="rule"])',
          {
            x: -6,
            opacity: 0,
            duration: 0.38,
            stagger: 0.08,
            ease: "power2.out",
          },
          "-=0.28",
        )
        .from(
          '[data-motion="caption"]',
          { opacity: 0, duration: 0.32, ease: "power2.out" },
          "-=0.15",
        );
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
