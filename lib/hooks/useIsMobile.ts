"use client";

import * as React from "react";

/**
 * Is the viewport narrow enough that the sidebar must become a drawer?
 *
 * Built on `useSyncExternalStore` rather than the usual
 * `useState` + `useEffect(() => setX(mql.matches))` pattern, for two reasons:
 *
 *   1. That pattern calls `setState` synchronously inside an effect, which
 *      `react-hooks/set-state-in-effect` rejects — and suppressing the rule
 *      would be hiding a real cascading-render cost, not satisfying a linter.
 *   2. `useSyncExternalStore` is tear-free. The layout reads this value in
 *      several places in one pass; with the effect version they can disagree
 *      for a frame, which is exactly how a sidebar ends up rendering its
 *      desktop rail and its mobile drawer at the same time.
 *
 * `getServerSnapshot` returns false, so the server always renders the desktop
 * rail. That is the right default: it matches the cookie-driven `defaultOpen`
 * the layout passes in, and a desktop-first guess is cheap to correct on a
 * phone, whereas guessing mobile flashes a drawer on every desktop load.
 */
const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/** Cached so `getSnapshot` does not build a MediaQueryList on every render. */
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

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
