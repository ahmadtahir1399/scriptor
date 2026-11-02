"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconArrowRight, IconTrend } from "@/components/icons";

import type { VersionScorePoint } from "@/lib/papers/presentation";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";
import { ScoreChip } from "@/components/papers/ScoreChip";

/**
 * The version-comparison header — every version's score in order, with the
 * change since the previous draft called out. This is the retention hook: a
 * student who sees "72 → 81 → 88" believes the tool is working. With a single
 * version it becomes a gentle nudge to upload a revised draft.
 */
export interface VersionScoreTrendProps {
  trend: readonly VersionScorePoint[];
  currentDelta: number | null;
}

export function VersionScoreTrend({
  trend,
  currentDelta,
}: VersionScoreTrendProps) {
  const t = useTranslations("papers.trend");

  if (trend.length <= 1) {
    const only = trend[0]?.score ?? null;
    return (
      <SectionCard>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-micro text-muted uppercase">
              {t("currentScore")}
            </p>
            <div className="mt-1">
              <ScoreChip score={only} size="lg" />
            </div>
          </div>
          <p className="text-meta text-muted max-w-xs text-right">
            {t("singleNudge")}
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="flex flex-wrap items-center gap-3">
        {trend.map((point, index) => (
          <React.Fragment key={point.versionNumber}>
            {index > 0 ? (
              <IconArrowRight
                className="text-muted size-4 shrink-0"
                aria-hidden="true"
              />
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <span className="text-micro text-muted uppercase">
                {t("versionShort", { n: point.versionNumber })}
              </span>
              <ScoreChip
                score={point.score}
                size={index === trend.length - 1 ? "lg" : "md"}
              />
            </div>
          </React.Fragment>
        ))}

        {currentDelta !== null && currentDelta !== 0 ? (
          <Badge
            variant={currentDelta > 0 ? "verified" : "critical"}
            className="ml-1"
          >
            <IconTrend aria-hidden="true" />
            {t("delta", {
              delta:
                currentDelta > 0 ? `+${currentDelta}` : String(currentDelta),
            })}
          </Badge>
        ) : null}
      </div>
    </SectionCard>
  );
}
