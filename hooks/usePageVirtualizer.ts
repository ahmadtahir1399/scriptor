"use client";

import * as React from "react";

/**
 * Decides which pages render a canvas.
 *
 * A 150-page thesis must never mount 150 canvases. This tracks the scroll
 * container and returns the set of page indices in and near the viewport; pages
 * outside it render a height-preserving placeholder instead, so scroll position
 * stays stable while far canvases are unmounted.
 *
 * Uses an IntersectionObserver over per-page sentinels (registered by the page
 * components), plus an overscan buffer so a page is mounted slightly before it
 * scrolls in and unmounted slightly after it leaves — no blank flash at the
 * edges.
 */

export interface Virtualizer {
  registerPage: (pageNumber: number, element: HTMLElement | null) => void;
  isPageActive: (pageNumber: number) => boolean;
  visiblePages: number[];
}

export function usePageVirtualizer(overscan = 2): Virtualizer {
  const elements = React.useRef(new Map<number, HTMLElement>());
  const observer = React.useRef<IntersectionObserver | null>(null);
  const [intersecting, setIntersecting] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        setIntersecting((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const pageAttr = entry.target.getAttribute("data-page");
            if (!pageAttr) continue;
            const page = Number(pageAttr);
            if (entry.isIntersecting) next.add(page);
            else next.delete(page);
          }
          return next;
        });
      },
      // A tall rootMargin is the overscan: pages within ~1.5 viewports mount.
      { rootMargin: "150% 0px 150% 0px", threshold: 0 },
    );

    return () => observer.current?.disconnect();
  }, []);

  const registerPage = React.useCallback((pageNumber: number, element: HTMLElement | null) => {
    const existing = elements.current.get(pageNumber);
    if (existing && observer.current) observer.current.unobserve(existing);

    if (element) {
      element.setAttribute("data-page", String(pageNumber));
      elements.current.set(pageNumber, element);
      observer.current?.observe(element);
    } else {
      elements.current.delete(pageNumber);
    }
  }, []);

  // Expand the intersecting set by the overscan so neighbours are pre-mounted.
  const activePages = React.useMemo(() => {
    const active = new Set<number>();
    for (const page of intersecting) {
      for (let offset = -overscan; offset <= overscan; offset += 1) {
        if (page + offset >= 1) active.add(page + offset);
      }
    }
    return active;
  }, [intersecting, overscan]);

  const isPageActive = React.useCallback((pageNumber: number) => activePages.has(pageNumber), [activePages]);

  const visiblePages = React.useMemo(
    () => [...intersecting].sort((a, b) => a - b),
    [intersecting],
  );

  return { registerPage, isPageActive, visiblePages };
}
