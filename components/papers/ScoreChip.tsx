import * as React from "react";

import { cn } from "@/lib/utils";
import { scoreTone } from "@/lib/analysis/presentation";

/**
 * A compact academic-score chip, colour-banded on the app's semantic contract
 * via `scoreTone` (clay <50, honey 50–69, sage ≥70, muted when unscored). This
 * component owns no thresholds of its own — the band comes from `scoreTone`, the
 * one place those boundaries live.
 */
export interface ScoreChipProps {
  score: number | null;
  size?: "md" | "lg";
  className?: string;
}

const TONE_CLASS = {
  verified: "bg-verified-soft text-verified",
  warning: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
  muted: "bg-bg text-muted",
} as const;

export function ScoreChip({ score, size = "md", className }: ScoreChipProps) {
  const tone = scoreTone(score);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold tabular-nums",
        size === "lg" ? "text-page-title px-3 py-1" : "text-body px-2 py-0.5",
        TONE_CLASS[tone],
        className,
      )}
    >
      {score === null ? "—" : Math.round(score)}
    </span>
  );
}
