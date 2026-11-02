"use client";

import { useLinkStatus } from "next/link";

/**
 * Acknowledges a click while the navigation is still in flight.
 *
 * Must be rendered INSIDE a `Link` — `useLinkStatus` reads the context that
 * `next/link` provides, and returns a permanent `{ pending: false }` anywhere
 * else. next-intl's `Link` renders `next/link` directly (see
 * `navigation/shared/BaseLink.js`), so the localised link satisfies this.
 *
 * WHY THIS EXISTS. Next updates the url the moment a link is clicked, but the
 * old page stays on screen until the destination resolves. For a protected
 * route that is a proxy redirect plus a render, which measured at roughly four
 * seconds against production — four seconds that look exactly like a dead
 * button, so the visitor clicks again and restarts the wait.
 *
 * The Next docs are right that the real fix is prefetching and `loading.js`,
 * and both are already in place for the `(app)` group. Neither helps here: the
 * `(app)` LAYOUT has to run `RequireAuth` before any `loading.js` beneath it
 * can paint, and a signed-out visitor is redirected before the route renders
 * at all. So the wait is genuine, and the honest thing is to show it.
 *
 * Rendering is delegated entirely to `.link-pending` in `globals.css`; the only
 * thing this component contributes is the flag.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className="link-pending"
      data-pending={pending || undefined}
    />
  );
}
