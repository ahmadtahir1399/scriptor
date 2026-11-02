"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconPanel } from "@/components/icons";

import type { FindingSeverity } from "@/lib/db/enums";
import type { Finding } from "@/lib/domain/analysis";
import type { PDFDocumentProxy } from "@/lib/viewer/pdfWorker";
import { useViewerStore } from "@/store/viewerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ThumbnailItem } from "@/components/viewer/ThumbnailItem";

/**
 * The collapsible thumbnail rail.
 *
 * Each page's highest-severity unresolved finding drives its marker dot, so the
 * reader can see at a glance which pages still need attention. Collapsing
 * reclaims horizontal space for the document.
 */
export interface ThumbnailRailProps {
  pdf: PDFDocumentProxy | null;
  numPages: number;
  findings: readonly Finding[];
  onJump: (pageNumber: number) => void;
}

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function ThumbnailRail({
  pdf,
  numPages,
  findings,
  onJump,
}: ThumbnailRailProps) {
  const t = useTranslations("viewer");
  const collapsed = useViewerStore((s) => s.thumbnailsCollapsed);
  const toggle = useViewerStore((s) => s.toggleThumbnails);
  const currentPage = useViewerStore((s) => s.currentPage);
  const resolvedOptimistic = useViewerStore((s) => s.resolvedOptimistic);

  // Highest-severity UNRESOLVED finding per page → marker dot.
  const markerByPage = React.useMemo(() => {
    const map = new Map<number, FindingSeverity>();
    for (const finding of findings) {
      if (finding.page_number === null) continue;
      const resolved = resolvedOptimistic[finding.id] ?? finding.is_resolved;
      if (resolved) continue;
      const current = map.get(finding.page_number);
      if (
        !current ||
        SEVERITY_RANK[finding.severity] > SEVERITY_RANK[current]
      ) {
        map.set(finding.page_number, finding.severity);
      }
    }
    return map;
  }, [findings, resolvedOptimistic]);

  if (collapsed) {
    return (
      <div className="border-border shrink-0 border-r p-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={t("expandThumbnails")}
        >
          <IconPanel aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border flex w-[120px] shrink-0 flex-col border-r">
      <div className="border-border flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-micro text-muted uppercase">{t("pages")}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={t("collapseThumbnails")}
        >
          <IconPanel aria-hidden="true" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-1 p-2">
          {Array.from({ length: numPages }, (_, index) => index + 1).map(
            (page) => (
              <ThumbnailItem
                key={page}
                pdf={pdf}
                pageNumber={page}
                isCurrent={page === currentPage}
                markerSeverity={markerByPage.get(page) ?? null}
                onJump={onJump}
              />
            ),
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
