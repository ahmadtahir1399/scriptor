"use client";

import * as React from "react";
import Lenis from "lenis";

import { SCROLL } from "@/lib/constants";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

/**
 * Inertia scrolling, scoped to the marketing route group.
 *
 * Deliberately NOT mounted in the root layout. Lenis takes over the document's
 * scroll, and the one place that must never happen is `(app)` — it contains a
 * PDF viewer whose page virtualiser does its own scroll maths. Hijacking that
 * would desynchronise the highlight overlay from the page under it.
 *
 * `children` arrives already rendered by the server. Passing a server subtree
 * through a client boundary as a prop keeps it a Server Component: this file
 * ships to the browser, the marketing copy does not.
 *
 * Under reduced motion no Lenis instance is constructed at all. That is the
 * scroll equivalent of the rule in `globals.css` about `.arc-draw` — a smooth
 * scroller configured to be instant is still a scroller intercepting wheel
 * events, so it is not built rather than built and neutered.
 */
export function SmoothScroll({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) return;

    const lenis = new Lenis({ lerp: SCROLL.lerp, smoothWheel: true });

    // ScrollTrigger has to recompute on every Lenis frame, and Lenis has to be
    // driven by GSAP's ticker rather than its own rAF — two independent loops
    // reading scroll position drift apart and the parallax visibly jitters.
    const update = () => ScrollTrigger.update();
    const raf = (time: number) => lenis.raf(time * 1000);

    lenis.on("scroll", update);
    gsap.ticker.add(raf);
    // Lag smoothing pauses the ticker after a long frame, which strands Lenis
    // mid-animation. Off here, restored to GSAP's default on teardown.
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", update);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, [reduced]);

  return <>{children}</>;
}
