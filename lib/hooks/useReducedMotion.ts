"use client";

import * as React from "react";

import { MOTION } from "@/lib/constants";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Tracks the user's reduced-motion preference.
 *
 * Built on `useSyncExternalStore`, not `useState` + an effect that calls
 * `setReduced(mql.matches)`. That older shape has two real problems, and the
 * lint rule that rejects it (`react-hooks/set-state-in-effect`) is right:
 *
 *   1. It renders once with the wrong answer and then re-renders — which for a
 *      motion hook means one frame of animation plays before we learn the user
 *      asked for none. That is precisely the frame they did not want.
 *   2. Several components read this in one pass. With the effect version they
 *      can briefly disagree, so half a page animates and half does not.
 *
 * `getServerSnapshot` returns false because the server cannot know the
 * preference; the client's first paint already has the true value.
 *
 * NOTE: prefer the CSS motion classes in `globals.css` (`.rise`, `.arc-draw`,
 * `.count-up`) over this hook. They honour the preference in the stylesheet
 * and keep the component a Server Component. Reach for this only when the
 * motion is genuinely stateful and framer-motion is already in play.
 */
let mediaQuery: MediaQueryList | null = null;

function getMediaQuery(): MediaQueryList {
  mediaQuery ??= window.matchMedia(QUERY);
  return mediaQuery;
}

function subscribe(onChange: () => void): () => void {
  const mql = getMediaQuery();
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return getMediaQuery().matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The shape Framer Motion needs for a fade-and-rise entrance. */
export interface FadeRiseMotion {
  initial: { opacity: number; y: number };
  animate: { opacity: number; y: number };
  transition: {
    duration: number;
    ease: readonly [number, number, number, number];
  };
}

/**
 * The fade-and-rise entrance, reduced-motion aware.
 *
 * For framer-motion subtrees only. Anything that can be a Server Component
 * should use the `.rise` class with a `--rise-delay` instead — same motion,
 * no client bundle.
 */
export function useFadeRise(delay = 0): FadeRiseMotion {
  const reduced = useReducedMotion();

  if (reduced) {
    return {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0, ease: MOTION.ease },
    };
  }

  return {
    initial: { opacity: 0, y: MOTION.riseY },
    animate: { opacity: 1, y: 0 },
    transition: { duration: MOTION.duration + delay, ease: MOTION.ease },
  };
}
