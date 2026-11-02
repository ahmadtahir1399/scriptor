"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { PageType } from "@/lib/db/enums";
import type { PDFDocumentProxy } from "@/lib/viewer/pdfWorker";
import type { Finding } from "@/lib/domain/analysis";
import type { Word } from "@/lib/domain/paper";
import { scaleForWidth } from "@/lib/viewer/geometry";
import { Badge } from "@/components/ui/badge";
import { HighlightLayer } from "@/components/viewer/HighlightLayer";

/**
 * One rendered page: a canvas plus its highlight overlay.
 *
 * Virtualized — when `active` is false the canvas is unmounted and only a
 * height-preserving placeholder remains, so a 150-page thesis never mounts 150
 * canvases and scroll position stays stable. The canvas renders at
 * device-pixel-ratio × CSS scale for crispness; the overlay is a sibling layer,
 * never painted onto the canvas, so highlights stay interactive.
 *
 * Highlight scale is `renderWidth / page_width` — the exact inverse of P3's
 * extraction, no vertical flip (P3 already flipped). If a highlight is mirrored,
 * fix P3, not here.
 */
export interface PdfPageProps {
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  pageType: PageType;
  /** CSS width to render at; all pages share it so zoom is uniform. */
  renderWidth: number;
  active: boolean;
  findings: readonly Finding[];
  words: readonly Word[];
  registerRef: (pageNumber: number, element: HTMLElement | null) => void;
  onResolveToggle: (findingId: string, nextResolved: boolean) => void;
}

const NON_BODY_BADGE: Partial<Record<PageType, boolean>> = {
  COVER: true,
  ABSTRACT: true,
  TOC: true,
  BIBLIOGRAPHY: true,
  APPENDIX: true,
  LIST_OF_ABBREVIATIONS: true,
};

export function PdfPage({
  pdf,
  pageNumber,
  pageWidth,
  pageHeight,
  pageType,
  renderWidth,
  active,
  findings,
  words,
  registerRef,
  onResolveToggle,
}: PdfPageProps) {
  const t = useTranslations("viewer");
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const aspect = pageWidth > 0 ? pageHeight / pageWidth : Math.SQRT2;
  const renderHeight = renderWidth * aspect;
  const scale = scaleForWidth(renderWidth, pageWidth);

  // Register/unregister with the virtualizer's IntersectionObserver.
  React.useEffect(() => {
    const element = containerRef.current;
    registerRef(pageNumber, element);
    return () => registerRef(pageNumber, null);
  }, [pageNumber, registerRef]);

  // Render the canvas when active. Cancels an in-flight render on change so a
  // fast scroll or zoom does not leave a half-painted page.
  React.useEffect(() => {
    if (!active || !pdf) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    // Re-narrow inside the async closure: TS re-widens captured pdf/canvas here.
    const doc = pdf;
    const target = canvas;

    async function render() {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = renderWidth / baseViewport.width;
        const dpr =
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale: cssScale * dpr });

        const context = target.getContext("2d");
        if (!context) return;

        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        target.style.width = `${renderWidth}px`;
        target.style.height = `${renderHeight}px`;

        const task = page.render({ canvasContext: context, viewport });
        renderTask = task;
        await task.promise;
      } catch (error) {
        // A cancelled render throws a RenderingCancelledException — expected on
        // fast scroll/zoom, not an error worth surfacing.
        if (
          !cancelled &&
          !(
            error instanceof Error &&
            error.name === "RenderingCancelledException"
          )
        ) {
          console.error(`[viewer] page ${pageNumber} render failed`, error);
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [active, pdf, pageNumber, renderWidth, renderHeight]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto"
      style={{ width: renderWidth, height: renderHeight }}
      data-page={pageNumber}
    >
      {active ? (
        <>
          <canvas
            ref={canvasRef}
            className="border-border block rounded-sm border shadow-card"
            style={{ width: renderWidth, height: renderHeight }}
          />
          <HighlightLayer
            findings={findings}
            words={words}
            scale={scale}
            onResolveToggle={onResolveToggle}
          />
        </>
      ) : (
        <div
          className="border-border bg-surface flex items-center justify-center rounded-sm border"
          style={{ width: renderWidth, height: renderHeight }}
        >
          <span className="text-meta text-muted">
            {t("pagePlaceholder", { page: pageNumber })}
          </span>
        </div>
      )}

      {NON_BODY_BADGE[pageType] ? (
        <Badge
          variant="outline"
          className={cn("absolute top-2 right-2 bg-surface/90")}
        >
          {t(`pageType.${pageType}`)}
        </Badge>
      ) : null}
    </div>
  );
}
