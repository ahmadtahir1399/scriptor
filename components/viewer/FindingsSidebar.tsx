"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Finding } from "@/lib/domain/analysis";
import { useViewerStore } from "@/store/viewerStore";
import { findingMatchesFilter } from "@/lib/validations/finding";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FindingSidebarItem } from "@/components/viewer/FindingSidebarItem";
import {
  ViewerEmptyState,
  type ViewerEmptyKind,
} from "@/components/viewer/ViewerEmptyState";

/**
 * The findings sidebar, grouped by page.
 *
 * Bidirectionally synced with the document through `viewerStore`: hovering a row
 * brightens its highlight, clicking focuses+scrolls it, and scroll-spy scrolls
 * the sidebar to the page currently on screen. Filter and show-resolved come
 * from the toolbar via the store, applied here live.
 */
export interface FindingsSidebarProps {
  findings: readonly Finding[];
  onResolveToggle: (findingId: string, nextResolved: boolean) => void;
}

export function FindingsSidebar({
  findings,
  onResolveToggle,
}: FindingsSidebarProps) {
  const t = useTranslations("viewer.sidebar");

  const filter = useViewerStore((s) => s.severityFilter);
  const showResolved = useViewerStore((s) => s.showResolved);
  const resolvedOptimistic = useViewerStore((s) => s.resolvedOptimistic);
  const currentPage = useViewerStore((s) => s.currentPage);
  const focusedFindingId = useViewerStore((s) => s.focusedFindingId);
  const setHoveredFinding = useViewerStore((s) => s.setHoveredFinding);
  const setFocusedFinding = useViewerStore((s) => s.setFocusedFinding);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const isResolved = React.useCallback(
    (finding: Finding) => resolvedOptimistic[finding.id] ?? finding.is_resolved,
    [resolvedOptimistic],
  );

  const visible = React.useMemo(
    () =>
      findings.filter(
        (finding) =>
          findingMatchesFilter(finding, filter) &&
          (showResolved || !isResolved(finding)),
      ),
    [findings, filter, showResolved, isResolved],
  );

  // Group visible findings by page, pages ascending.
  const groups = React.useMemo(() => {
    const map = new Map<number, Finding[]>();
    for (const finding of visible) {
      const page = finding.page_number ?? 0;
      const list = map.get(page);
      if (list) list.push(finding);
      else map.set(page, [finding]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  // Scroll-spy: bring the current page's group into view as the doc scrolls.
  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector(
      `[data-page-group="${currentPage}"]`,
    );
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  // When a finding is focused (canvas click / deep-link), scroll the sidebar to it.
  React.useEffect(() => {
    if (!focusedFindingId) return;
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector(
      `[data-finding-id="${focusedFindingId}"]`,
    );
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedFindingId]);

  if (findings.length === 0) {
    return <ViewerEmptyState kind="none" totalCount={0} />;
  }

  if (visible.length === 0) {
    const allResolved = findings.every((finding) => isResolved(finding));
    const kind: ViewerEmptyKind =
      allResolved && !showResolved ? "resolved" : "filtered";
    return <ViewerEmptyState kind={kind} totalCount={findings.length} />;
  }

  return (
    <div ref={scrollRef} className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-4 p-3">
          {groups.map(([page, pageFindings]) => (
            <div key={page} data-page-group={page}>
              <p className="text-micro text-muted mb-2 uppercase">
                {t("pageHeading", { page })}
              </p>
              <div className="flex flex-col gap-2">
                {pageFindings.map((finding) => (
                  <FindingSidebarItem
                    key={finding.id}
                    finding={finding}
                    resolved={isResolved(finding)}
                    focused={focusedFindingId === finding.id}
                    onHover={setHoveredFinding}
                    onFocus={setFocusedFinding}
                    onResolveToggle={onResolveToggle}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
