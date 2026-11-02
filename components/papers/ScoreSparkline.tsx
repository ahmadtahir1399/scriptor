import * as React from "react";

import { cn } from "@/lib/utils";
import { scoreTone } from "@/lib/analysis/presentation";

/**
 * A tiny score-across-versions sparkline — the "it's improving" signal at a
 * glance. Renders only when there are at least two scored versions; a single
 * point is not a trend. The domain is fixed 0–100 so the slope is honest across
 * cards rather than auto-scaled per paper.
 */
export interface ScoreSparklineProps {
  scores: ReadonlyArray<number | null>;
  width?: number;
  height?: number;
  className?: string;
}

const STROKE_TONE = {
  verified: "text-verified",
  warning: "text-warning",
  critical: "text-critical",
  muted: "text-muted",
} as const;

export function ScoreSparkline({
  scores,
  width = 76,
  height = 24,
  className,
}: ScoreSparklineProps) {
  const points = scores.filter((score): score is number => score !== null);
  if (points.length < 2) return null;

  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const stepX = innerW / (points.length - 1);

  const coords = points.map((score, index) => {
    const x = pad + index * stepX;
    const y = pad + innerH - (Math.max(0, Math.min(100, score)) / 100) * innerH;
    return { x, y };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const last = coords[coords.length - 1];
  const tone = STROKE_TONE[scoreTone(points[points.length - 1] ?? null)];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(tone, className)}
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last ? (
        <circle cx={last.x} cy={last.y} r={2.2} fill="currentColor" />
      ) : null}
    </svg>
  );
}
