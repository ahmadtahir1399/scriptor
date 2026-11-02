"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { scoreTone, type ScoreTone } from "@/lib/analysis/presentation";
import type { CategoryScore } from "@/lib/analysis/scoring";

/**
 * The four category rows — Structure, Referencing, Style, Argumentation.
 *
 * Values come straight from `scoring.ts`; this component never maps checks to
 * categories itself. A category whose checks all errored (or haven't run) shows
 * a muted empty bar rather than a misleading zero.
 */
export interface CategoryBreakdownProps {
  categories: readonly CategoryScore[];
}

const TONE_BAR: Record<ScoreTone, string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  verified: "bg-verified",
  muted: "bg-border",
};

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const t = useTranslations("analysis.category");

  return (
    <div className="flex flex-col gap-3">
      {categories.map((category) => {
        const tone = scoreTone(category.score);
        const width = category.score ?? 0;

        return (
          <div key={category.category}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-meta text-ink">{t(category.category)}</span>
              <span className="text-meta text-muted tabular-nums">
                {category.score === null
                  ? t("notScored")
                  : Math.round(category.score)}
              </span>
            </div>
            <div className="bg-border/50 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  TONE_BAR[tone],
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
