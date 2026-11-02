import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Score across a paper's versions.
 *
 * ── Why this is not a chart library ──────────────────────────────────────
 * Recharts and friends are client components: pulling one in would drag the
 * dashboard — currently a Server Component with no JS of its own — into the
 * bundle for the sake of a five-point line. This is ~40 lines of SVG and it
 * animates through the same `.arc-draw` keyframe the score gauge uses, so the
 * two draw in the same voice.
 *
 * ── The draw ─────────────────────────────────────────────────────────────
 * `pathLength={1}` normalises the line's length so `--dash: 1` works without
 * ever measuring the DOM — no ref, no effect, no layout read. The area fill
 * cannot be "drawn", so it wipes in behind the line via `.arc-draw-fill`.
 *
 * Both write their FINAL state as the static declaration and use the keyframe
 * only for the `from`, so when `prefers-reduced-motion` strips the animation
 * the chart is complete and correct rather than an empty frame.
 *
 * ── Accessibility ────────────────────────────────────────────────────────
 * The SVG is `role="img"` with a label naming the paper and the range. The
 * per-version values are ALSO emitted as an `sr-only` list, because a summary
 * label alone loses the actual data — a screen-reader user should be able to
 * hear the same numbers a sighted user can read off the line.
 */
export interface ScoreTrendPoint {
  versionNumber: number;
  score: number;
}

export interface ScoreTrendChartProps {
  points: readonly ScoreTrendPoint[];
  /** Full sentence describing the series, e.g. "Score across 4 versions of X". */
  label: string;
  /** Per-point sr-only text, already translated and formatted. */
  pointLabels: readonly string[];
  className?: string;
}

const WIDTH = 320;
const HEIGHT = 132;
const PAD_X = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 16;

const INNER_W = WIDTH - PAD_X * 2;
const INNER_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

/** Score is always a 0–100 scale, so the axis is fixed — never data-fitted.
 *  Auto-scaling a bounded score exaggerates a two-point wobble into a cliff. */
function toXY(index: number, count: number, score: number) {
  const x = count === 1 ? PAD_X + INNER_W / 2 : PAD_X + (index / (count - 1)) * INNER_W;
  const y = PAD_TOP + (1 - Math.max(0, Math.min(100, score)) / 100) * INNER_H;
  return { x, y };
}

export function ScoreTrendChart({
  points,
  label,
  pointLabels,
  className,
}: ScoreTrendChartProps) {
  const count = points.length;
  const coords = points.map((point, index) => toXY(index, count, point.score));

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");

  const first = coords[0];
  const last = coords[coords.length - 1];

  // Close the line down to the baseline to make the fill.
  const area =
    first && last
      ? `${line} L${last.x.toFixed(2)} ${(HEIGHT - PAD_BOTTOM).toFixed(2)} L${first.x.toFixed(2)} ${(HEIGHT - PAD_BOTTOM).toFixed(2)} Z`
      : "";

  return (
    /*
     * `min-w-0` on BOTH the wrapper and the svg is what makes this chart
     * responsive inside a grid.
     *
     * An inline <svg> with a viewBox is a replaced element with an intrinsic
     * size, so its min-content contribution is that intrinsic width — not 0.
     * A grid or flex item defaults to `min-width: auto`, which means "no
     * smaller than min-content", so the card containing this chart refused to
     * shrink below ~460px and pushed the whole page into a horizontal scroll
     * on every phone. Letting the svg shrink lets the card shrink.
     */
    <div className={cn("w-full min-w-0", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        /* Default (uniform) preserveAspectRatio, deliberately: `none` would
           scale x and y independently and the 2px line would render as an
           uneven, squashed stroke at every width but one. */
        className="block h-auto w-full min-w-0"
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id="score-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-green-300)"
              stopOpacity={0.42}
            />
            <stop
              offset="100%"
              stopColor="var(--color-green-300)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>

        {/* Gridlines at 0 / 50 / 100. Hairlines only — they orient, they do
            not compete with the line. */}
        {[0, 50, 100].map((value) => {
          const y = PAD_TOP + (1 - value / 100) * INNER_H;
          return (
            <line
              key={value}
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeDasharray={value === 0 ? undefined : "2 4"}
            />
          );
        })}

        {area ? (
          <path d={area} fill="url(#score-trend-fill)" className="arc-draw-fill" />
        ) : null}

        <path
          d={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="arc-draw"
          style={{ "--dash": 1, "--fill": 1 } as React.CSSProperties}
        />

        {/* Honey end-cap — the single metallic touch, and it lands on the
            value the student cares about most: the current one. */}
        {last ? (
          <circle
            cx={last.x}
            cy={last.y}
            r={4}
            fill="var(--color-surface)"
            stroke="var(--color-decor)"
            strokeWidth={2.5}
            className="arc-draw-fill"
          />
        ) : null}
      </svg>

      <ul className="sr-only">
        {pointLabels.map((text, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
