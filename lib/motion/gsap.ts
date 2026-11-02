"use client";

/**
 * Single registration point for GSAP and its scroll plugin.
 *
 * `registerPlugin` is idempotent, but calling it from every component that
 * wants ScrollTrigger means every one of those components has to remember to.
 * One module that does it on import removes the chance to forget.
 *
 * The `typeof window` guard matters: a `"use client"` module is still
 * evaluated on the server to produce the initial HTML, and ScrollTrigger
 * touches `document` as it registers.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };
