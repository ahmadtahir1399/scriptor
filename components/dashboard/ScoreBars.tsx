import * as React from "react";

import { scoreTone } from "@/lib/analysis/presentation";
import type { ScoreTone } from "@/lib/analysis/presentation";
import type { PaperScoreView } from "@/lib/dashboard/presentation";

/**
 * Score per paper, as bars.
 *
 * This fills the trend slot before any paper has a second draft. A chart of one
 * point is not a trend, and an empty chart frame is just a hole in the page —
 * whereas "here is how your papers compare" is real information the student
 * already has a use for.
 *
 * The bars use the same `scoreTone` bands as the gauge and the score chips, so
 * a paper reads the same colour wherever it appears. The number is always
 * printed beside the bar: the colour reinforces the value, it never carries it.
 *
 * Widths are inline percentages driven by the score, and the fill animates from
 * zero via `.arc-draw-fill` — the same wipe the chart's area uses, so the two
 * states of this slot enter in the same voice.
 */
export interface ScoreBarsProps {
  papers: readonly PaperScoreView[];
}

const TONE_FILL: Record<ScoreTone, string> = {
  critical: "bg-critical",
  warning: "bg-decor",
  verified: "bg-verified",
  muted: "bg-green-400",
};

export function ScoreBars({ papers }: ScoreBarsProps) {
  return (
    <ul className="rise-stagger flex flex-col gap-3.5">
      {papers.map((paper, index) => (
        <li
          key={paper.paperId}
          className="min-w-0"
          style={{ "--i": index } as React.CSSProperties}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-meta text-ink min-w-0 truncate">
              {paper.title}
            </span>
            <span className="display text-ink shrink-0 text-[15px] tabular-nums">
              {paper.score}
            </span>
          </div>

          {/* Almond well + toned fill. `aria-hidden` because the number above
              is the accessible value; a progressbar role here would make a
              screen reader announce the same score twice. */}
          <div
            aria-hidden="true"
            className="bg-primary-soft mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
          >
            <div
              className={`arc-draw-fill h-full rounded-full ${TONE_FILL[scoreTone(paper.score)]}`}
              style={{ width: `${Math.max(0, Math.min(100, paper.score))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
