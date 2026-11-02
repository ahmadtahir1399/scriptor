"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { FINDING_QUERY_PARAM } from "@/lib/analysis/presentation";
import { resolveFinding } from "@/lib/viewer/actions";
import { usePdfDocument } from "@/hooks/usePdfDocument";
import { useDocumentViewer } from "@/hooks/useDocumentViewer";
import { usePageVirtualizer } from "@/hooks/usePageVirtualizer";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { useViewerStore } from "@/store/viewerStore";
import { ErrorState } from "@/components/shared/ErrorState";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ViewerToolbar } from "@/components/viewer/ViewerToolbar";
import { PdfPage } from "@/components/viewer/PdfPage";
import { ThumbnailRail } from "@/components/viewer/ThumbnailRail";
import { FindingsSidebar } from "@/components/viewer/FindingsSidebar";
import { FindingsOnlyFallback } from "@/components/viewer/FindingsOnlyFallback";

/**
 * The viewer orchestrator — the one client boundary that owns the PDF, the
 * scroll container, and the finding↔document sync.
 *
 * Three regions: thumbnail rail, document scroll area, findings sidebar. It
 * loads the PDF via a signed URL, virtualizes pages so a 150-page thesis never
 * mounts 150 canvases, honours the `?finding=` deep-link on load, and routes
 * every resolve through the single shared write path with optimistic rollback.
 *
 * When word geometry is unavailable (DOCX, or a parse with no words) it renders
 * the findings-only fallback instead — never a broken canvas.
 */
export interface DocumentViewerProps {
  analysisId: string;
  uploadId: string;
  geometryAvailable: boolean;
}

const RENDER_DEBOUNCE_MS = 150;

export function DocumentViewer({
  analysisId,
  uploadId,
  geometryAvailable,
}: DocumentViewerProps) {
  const t = useTranslations("viewer");
  const searchParams = useSearchParams();

  const { pdf, numPages, status, reload } = usePdfDocument(analysisId);
  const { findings, pages, wordsByPage } = useDocumentViewer(
    analysisId,
    uploadId,
  );

  const virtualizer = usePageVirtualizer();
  useScrollSpy(virtualizer.visiblePages);

  const zoomMode = useViewerStore((s) => s.zoomMode);
  const zoom = useViewerStore((s) => s.zoom);
  const setFocusedFinding = useViewerStore((s) => s.setFocusedFinding);
  const setOptimisticResolved = useViewerStore((s) => s.setOptimisticResolved);
  const clearOptimisticResolved = useViewerStore(
    (s) => s.clearOptimisticResolved,
  );

  // Own the scroll container and a page-element map (for jump + deep-link).
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const pageEls = React.useRef(new Map<number, HTMLElement>());

  const registerRef = React.useCallback(
    (pageNumber: number, element: HTMLElement | null) => {
      if (element) pageEls.current.set(pageNumber, element);
      else pageEls.current.delete(pageNumber);
      virtualizer.registerPage(pageNumber, element);
    },
    [virtualizer],
  );

  const onJump = React.useCallback((pageNumber: number) => {
    const element = pageEls.current.get(pageNumber);
    element?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  // Measure the document column so "Fit width" tracks resize.
  const [containerWidth, setContainerWidth] = React.useState(800);
  const docColumnRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const element = docColumnRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const referenceWidth = pages[0]?.page_width ?? 595;

  // Debounce render width so a burst of +/- clicks re-renders canvases once.
  const targetWidth = React.useMemo(() => {
    const available = Math.max(320, containerWidth - 48);
    if (zoomMode === "fit") return available;
    return Math.max(320, referenceWidth * zoom);
  }, [zoomMode, zoom, containerWidth, referenceWidth]);

  const [renderWidth, setRenderWidth] = React.useState(targetWidth);
  React.useEffect(() => {
    const timer = setTimeout(
      () => setRenderWidth(targetWidth),
      RENDER_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [targetWidth]);

  // Findings grouped by page for O(1) lookup per PdfPage.
  const findingsByPage = React.useMemo(() => {
    const map = new Map<number, typeof findings>();
    for (const finding of findings) {
      if (finding.page_number === null) continue;
      const list = map.get(finding.page_number);
      if (list) list.push(finding);
      else map.set(finding.page_number, [finding]);
    }
    return map;
  }, [findings]);

  // Optimistic resolve with rollback — the single shared write path.
  const onResolveToggle = React.useCallback(
    (findingId: string, nextResolved: boolean) => {
      setOptimisticResolved(findingId, nextResolved);
      void resolveFinding({ findingId, isResolved: nextResolved }).then(
        (result) => {
          if (result.ok) {
            clearOptimisticResolved(findingId);
          } else {
            setOptimisticResolved(findingId, !nextResolved);
            clearOptimisticResolved(findingId);
            toast.error(t("resolveFailed"));
          }
        },
      );
    },
    [setOptimisticResolved, clearOptimisticResolved, t],
  );

  // Honour ?finding= once findings are loaded.
  const deepLinked = React.useRef(false);
  React.useEffect(() => {
    if (deepLinked.current || findings.length === 0) return;
    const findingId = searchParams.get(FINDING_QUERY_PARAM);
    if (!findingId) return;

    const target = findings.find((finding) => finding.id === findingId);
    if (!target) return;

    deepLinked.current = true;
    setFocusedFinding(target.id);
    if (target.page_number !== null) {
      // Wait a tick for pages to lay out, then scroll.
      window.setTimeout(() => onJump(target.page_number as number), 200);
    }
  }, [findings, searchParams, setFocusedFinding, onJump]);

  // --- Fallback: no geometry (DOCX / no words) ---------------------------
  if (!geometryAvailable) {
    return <FindingsOnlyFallback findings={findings} />;
  }

  // --- PDF load error: retry (fresh signed URL) --------------------------
  if (status === "error") {
    return (
      <div className="py-10">
        <ErrorState
          title={t("loadError.title")}
          description={t("loadError.description")}
          onRetry={reload}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-220px)] min-h-[480px] overflow-hidden">
      <ThumbnailRail
        pdf={pdf}
        numPages={numPages}
        findings={findings}
        onJump={onJump}
      />

      <div ref={docColumnRef} className="flex min-w-0 flex-1 flex-col">
        <ViewerToolbar
          numPages={numPages}
          findingCount={findings.length}
          onJump={onJump}
        />

        <ScrollArea className="bg-bg flex-1">
          <div
            ref={scrollAreaRef}
            className="flex flex-col items-center gap-4 px-6 py-6"
          >
            {Array.from({ length: numPages }, (_, index) => index + 1).map(
              (pageNumber) => {
                const meta = pages.find(
                  (page) => page.page_number === pageNumber,
                );
                return (
                  <PdfPage
                    key={pageNumber}
                    pdf={pdf}
                    pageNumber={pageNumber}
                    pageWidth={meta?.page_width ?? referenceWidth}
                    pageHeight={
                      meta?.page_height ?? referenceWidth * Math.SQRT2
                    }
                    pageType={meta?.page_type ?? "BODY"}
                    renderWidth={renderWidth}
                    active={virtualizer.isPageActive(pageNumber)}
                    findings={findingsByPage.get(pageNumber) ?? []}
                    words={wordsByPage.get(pageNumber) ?? []}
                    registerRef={registerRef}
                    onResolveToggle={onResolveToggle}
                  />
                );
              },
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-border hidden w-[340px] shrink-0 border-l lg:block">
        <FindingsSidebar
          findings={findings}
          onResolveToggle={onResolveToggle}
        />
      </div>
    </div>
  );
}
