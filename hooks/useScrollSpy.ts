"use client";

import * as React from "react";

import { useViewerStore } from "@/store/viewerStore";

/**
 * Scroll-spy: keeps `viewerStore.currentPage` in step with what's on screen.
 *
 * Reads the virtualizer's currently-visible pages and picks the top-most one as
 * "current", which drives the toolbar page indicator, the thumbnail rail's
 * outline, and the sidebar's scroll-spy highlight. One writer for currentPage,
 * so the three consumers never disagree.
 */
export function useScrollSpy(visiblePages: readonly number[]): void {
  const setCurrentPage = useViewerStore((state) => state.setCurrentPage);

  React.useEffect(() => {
    if (visiblePages.length === 0) return;
    const top = visiblePages[0];
    if (top !== undefined) setCurrentPage(top);
  }, [visiblePages, setCurrentPage]);
}
