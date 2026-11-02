"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconArrowRight, IconChevronLeft, IconMinus, IconPlus } from "@/components/icons";

import { cn } from "@/lib/utils";
import { useViewerStore, type ZoomMode } from "@/store/viewerStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SeverityFilter } from "@/components/viewer/SeverityFilter";

/**
 * The viewer toolbar. Page nav, zoom, findings count + filter, show-resolved.
 * Every control writes to `viewerStore`; page nav calls `onJump` so the
 * DocumentViewer (which owns the scroll container) performs the scroll.
 */
export interface ViewerToolbarProps {
  numPages: number;
  findingCount: number;
  onJump: (pageNumber: number) => void;
}

export function ViewerToolbar({
  numPages,
  findingCount,
  onJump,
}: ViewerToolbarProps) {
  const t = useTranslations("viewer.toolbar");

  const currentPage = useViewerStore((s) => s.currentPage);
  const zoomMode = useViewerStore((s) => s.zoomMode);
  const zoom = useViewerStore((s) => s.zoom);
  const setZoomMode = useViewerStore((s) => s.setZoomMode);
  const setZoom = useViewerStore((s) => s.setZoom);
  const showResolved = useViewerStore((s) => s.showResolved);
  const toggleShowResolved = useViewerStore((s) => s.toggleShowResolved);

  const goPrev = () => onJump(Math.max(1, currentPage - 1));
  const goNext = () => onJump(Math.min(numPages, currentPage + 1));

  const zoomModes: { mode: ZoomMode; labelKey: string }[] = [
    { mode: "fit", labelKey: "fit" },
    { mode: "actual", labelKey: "actual" },
    { mode: "wide", labelKey: "wide" },
  ];

  return (
    <div className="border-border bg-surface flex flex-wrap items-center gap-2 border-b px-3 py-2">
      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goPrev}
          disabled={currentPage <= 1}
          aria-label={t("prevPage")}
        >
          <IconChevronLeft aria-hidden="true" />
        </Button>
        <span className="text-meta text-muted tabular-nums">
          {t("pageOf", { page: currentPage, total: numPages })}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goNext}
          disabled={currentPage >= numPages}
          aria-label={t("nextPage")}
        >
          <IconArrowRight aria-hidden="true" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Zoom — a segmented control built from buttons (no extra dep) */}
      <div className="border-border flex items-center overflow-hidden rounded-md border">
        {zoomModes.map(({ mode, labelKey }) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setZoomMode(mode);
              if (mode === "actual") setZoom(1);
              if (mode === "wide") setZoom(1.5);
            }}
            className={cn(
              "px-2.5 py-1 text-meta font-medium transition-colors",
              zoomMode === mode
                ? "bg-primary-soft text-primary"
                : "text-muted hover:text-ink",
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("zoomOut")}
          onClick={() => {
            setZoomMode("actual");
            setZoom(zoom - 0.1);
          }}
        >
          <IconMinus aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("zoomIn")}
          onClick={() => {
            setZoomMode("actual");
            setZoom(zoom + 0.1);
          }}
        >
          <IconPlus aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1" />

      {/* Findings count, filter, show-resolved */}
      <span className="text-meta text-muted">
        {t("findings", { count: findingCount })}
      </span>
      <SeverityFilter />
      <Button
        variant={showResolved ? "secondary" : "ghost"}
        size="sm"
        onClick={toggleShowResolved}
        aria-pressed={showResolved}
      >
        {t("showResolved")}
      </Button>
    </div>
  );
}
