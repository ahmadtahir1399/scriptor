"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Finding } from "@/lib/domain/analysis";
import type { Word } from "@/lib/domain/paper";
import { useViewerStore } from "@/store/viewerStore";
import {
  wordBoxesToRects,
  wordsInRange,
  type WordBox,
} from "@/lib/viewer/geometry";
import { mergeLineRects } from "@/lib/viewer/mergeLineRects";
import { HighlightBox } from "@/components/viewer/HighlightBox";
import { FindingPopover } from "@/components/viewer/FindingPopover";

/**
 * The highlight overlay for one page.
 *
 * For each finding on the page it selects the words of its index span, scales
 * them to CSS rects, and merges them into ONE RECT PER LINE (never a single
 * bounding box). Each line is a HighlightBox; the finding as a whole gets one
 * hover Popover anchored to its first line.
 *
 * All shared state (hovered / focused / optimistic-resolved) lives in
 * `viewerStore`, so this layer and the sidebar stay in sync without either
 * knowing about the other.
 */
export interface HighlightLayerProps {
  findings: readonly Finding[];
  words: readonly Word[];
  scale: number;
  onResolveToggle: (findingId: string, nextResolved: boolean) => void;
}

export function HighlightLayer({
  findings,
  words,
  scale,
  onResolveToggle,
}: HighlightLayerProps) {
  const t = useTranslations("viewer");

  const hoveredFindingId = useViewerStore((s) => s.hoveredFindingId);
  const focusedFindingId = useViewerStore((s) => s.focusedFindingId);
  const resolvedOptimistic = useViewerStore((s) => s.resolvedOptimistic);
  const setHoveredFinding = useViewerStore((s) => s.setHoveredFinding);
  const setFocusedFinding = useViewerStore((s) => s.setFocusedFinding);

  const wordBoxes: WordBox[] = React.useMemo(
    () =>
      words.map((word) => ({
        x1: word.x1,
        y1: word.y1,
        x2: word.x2,
        y2: word.y2,
        wordIndex: word.word_index,
      })),
    [words],
  );

  return (
    <div className="pointer-events-none absolute inset-0">
      {findings.map((finding) => {
        if (
          finding.word_index_start === null ||
          finding.word_index_end === null
        ) {
          return null;
        }

        const spanWords = wordsInRange(
          wordBoxes,
          finding.word_index_start,
          finding.word_index_end,
        );
        if (spanWords.length === 0) return null;

        const lines = mergeLineRects(wordBoxesToRects(spanWords, scale));
        if (lines.length === 0) return null;

        const resolved = resolvedOptimistic[finding.id] ?? finding.is_resolved;
        const hovered = hoveredFindingId === finding.id;
        const focused = focusedFindingId === finding.id;
        const anchor = lines[0];

        return (
          <React.Fragment key={finding.id}>
            {lines.map((rect, index) => (
              <HighlightBox
                key={`${finding.id}:${index}`}
                rect={rect}
                type={finding.type}
                resolved={resolved}
                focused={focused}
                hovered={hovered}
                label={t("highlightLabel", { title: finding.title })}
                onHoverStart={() => setHoveredFinding(finding.id)}
                onHoverEnd={() => setHoveredFinding(null)}
                onClick={() => setFocusedFinding(finding.id)}
              />
            ))}

            {anchor ? (
              <FindingPopover
                finding={finding}
                resolved={resolved}
                open={hovered}
                anchorRect={anchor}
                onOpenChange={(open) =>
                  setHoveredFinding(open ? finding.id : null)
                }
                onResolveToggle={() => onResolveToggle(finding.id, !resolved)}
                onOpenInSidebar={() => setFocusedFinding(finding.id)}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
