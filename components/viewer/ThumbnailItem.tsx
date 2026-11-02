"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { FindingSeverity } from "@/lib/db/enums";
import type { PDFDocumentProxy } from "@/lib/viewer/pdfWorker";

/**
 * One page thumbnail.
 *
 * Lazy and virtualized: the tiny canvas renders only once the item scrolls into
 * the rail's viewport, so opening a 150-page document does not render 150
 * thumbnails up front. A severity dot marks pages with unresolved findings; the
 * current page is outlined.
 */
export interface ThumbnailItemProps {
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  isCurrent: boolean;
  markerSeverity: FindingSeverity | null;
  onJump: (pageNumber: number) => void;
}

const THUMB_WIDTH = 84;

const DOT_TONE: Record<FindingSeverity, string> = {
  HIGH: "bg-critical",
  MEDIUM: "bg-warning",
  LOW: "bg-muted",
};

export function ThumbnailItem({
  pdf,
  pageNumber,
  isCurrent,
  markerSeverity,
  onJump,
}: ThumbnailItemProps) {
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setVisible(true);
        }
      },
      { root: element.parentElement, rootMargin: "200px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible || !pdf) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let task: { cancel: () => void } | null = null;

    // Re-narrow inside the async closure (TS re-widens captured pdf/canvas).
    const doc = pdf;
    const target = canvas;

    async function render() {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = THUMB_WIDTH / base.width;
        const viewport = page.getViewport({ scale });
        const context = target.getContext("2d");
        if (!context) return;
        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        const t = page.render({ canvasContext: context, viewport });
        task = t;
        await t.promise;
      } catch {
        // cancelled / transient — thumbnails are non-critical, stay silent.
      }
    }

    void render();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, pdf, pageNumber]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onJump(pageNumber)}
      className={cn(
        "group relative flex flex-col items-center gap-1 rounded-sm p-1 transition-colors",
        isCurrent ? "bg-primary-soft" : "hover:bg-bg",
      )}
      aria-current={isCurrent ? "page" : undefined}
    >
      <div
        className={cn(
          "bg-surface overflow-hidden rounded-[2px] border",
          isCurrent ? "border-primary border-2" : "border-border",
        )}
        style={{ width: THUMB_WIDTH }}
      >
        <canvas ref={canvasRef} className="block w-full" />
        {markerSeverity ? (
          <span
            className={cn(
              "absolute top-2 right-2 size-1.5 rounded-full",
              DOT_TONE[markerSeverity],
            )}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <span className="text-micro text-muted tabular-nums">{pageNumber}</span>
    </button>
  );
}
