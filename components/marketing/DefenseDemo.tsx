"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { IconMic, IconIdea } from "@/components/icons";

/**
 * One viva question, answered three times, and you can watch it get better.
 *
 * `defense_question_answers` is keyed by `(defense_practice_id,
 * defense_question_id)`, so the same question answered in two sessions is two
 * rows. The migration says exactly why that shape was chosen: "the student
 * needs to see whether their answer to the same question improved." Nothing
 * else on this page has a time axis, so this section is built on it.
 *
 * ── Why not another two-panel document view ───────────────────────────────
 * `defense_questions` also carries `source_quote` and `page_number`, and the
 * obvious build is a third "select a thing, highlight where it came from"
 * panel. `AnchoredViewer` and `RequirementsDemo` already are that. A third
 * would make the page feel like one screen restyled. The attempt scrubber is a
 * genuinely different verb: not selecting, but moving through time.
 *
 * The scores cross all three bands of the product's own `scoreBand` —
 * 48 needs work, 71 developing, 88 strong — so the tone changes as the answer
 * does, rather than three shades of the same colour.
 *
 * The score bar animates on a CSS transition rather than a keyframe: the value
 * changes in response to a click, so it has to interpolate from wherever it
 * currently is, which a keyframe cannot do.
 */

export interface DemoAttempt {
  id: string;
  label: string;
  date: string;
  score: number;
  answer: string;
  feedback: string;
}

export interface DefenseDemoProps {
  question: string;
  difficulty: string;
  sourceLabel: string;
  answerLabel: string;
  scoreLabel: string;
  attemptsLabel: string;
  attempts: readonly DemoAttempt[];
}

/** Mirrors `scoreBand` / `scoreTone` in `lib/analysis/presentation.ts`. */
function toneFor(score: number): "critical" | "warning" | "verified" {
  if (score < 50) return "critical";
  if (score < 85) return "warning";
  return "verified";
}

const BAR: Record<"critical" | "warning" | "verified", string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  verified: "bg-verified",
};

const TEXT: Record<"critical" | "warning" | "verified", string> = {
  critical: "text-critical",
  warning: "text-warning",
  verified: "text-verified",
};

export function DefenseDemo({
  question,
  difficulty,
  sourceLabel,
  answerLabel,
  scoreLabel,
  attemptsLabel,
  attempts,
}: DefenseDemoProps) {
  const [index, setIndex] = React.useState(attempts.length - 1);
  const current = attempts[index] ?? attempts[0];
  if (!current) return null;

  const tone = toneFor(current.score);

  return (
    <div className="bg-surface border-border shadow-card overflow-hidden rounded-lg border">
      {/* ── The question ──────────────────────────────────────────────── */}
      <div className="border-border bg-green-050/60 border-b px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <IconMic
            aria-hidden="true"
            className="text-primary size-4 shrink-0"
            strokeWidth={1.7}
          />
          <span className="eyebrow text-muted text-[10px]">{sourceLabel}</span>
          <Badge variant="ai" className="ml-auto shrink-0">
            {difficulty}
          </Badge>
        </div>

        {/* The committee's voice, so it is set in the display face rather than
            in `.prose-thesis` — this is not the student's writing. */}
        <p className="display text-primary mt-3 text-[17px] leading-snug text-balance sm:text-[19px]">
          {question}
        </p>
      </div>

      {/* ── The attempt scrubber ──────────────────────────────────────── */}
      <div className="border-border flex flex-wrap items-center gap-x-2 gap-y-2 border-b px-5 py-3 sm:px-7">
        <span className="eyebrow text-muted mr-1 text-[10px]">
          {attemptsLabel}
        </span>

        {attempts.map((attempt, i) => {
          const t = toneFor(attempt.score);
          const on = i === index;
          return (
            <button
              key={attempt.id}
              type="button"
              aria-pressed={on}
              onClick={() => setIndex(i)}
              className={cn(
                "focus-visible:outline-primary flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted hover:border-primary/40",
              )}
            >
              {attempt.label}
              {/* The score travels with its attempt, so the rise is visible in
                  the control itself before anything is clicked. */}
              <span
                className={cn(
                  "tabular-nums",
                  on ? "text-primary-foreground/80" : TEXT[t],
                )}
              >
                {attempt.score}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── The answer as it stood that day ───────────────────────────── */}
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="eyebrow text-muted text-[10px]">{answerLabel}</span>
          <span className="text-muted text-[11px] tabular-nums">
            {current.date}
          </span>
        </div>

        {/* The student's own words — `.prose-thesis`, as everywhere else. */}
        <p className="prose-thesis text-ink mt-2.5 text-[13.5px] leading-[1.85]">
          {current.answer}
        </p>

        <div className="border-border mt-5 border-t pt-4">
          <div className="flex items-center gap-3">
            <span className="eyebrow text-muted text-[10px]">{scoreLabel}</span>
            <span
              className={cn(
                "display text-[22px] leading-none tabular-nums",
                TEXT[tone],
              )}
            >
              {current.score}
            </span>
          </div>

          <div className="bg-primary-soft mt-2.5 h-1.5 overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full origin-left rounded-full transition-transform duration-500 ease-out",
                BAR[tone],
              )}
              style={{ transform: `scaleX(${current.score / 100})` }}
            />
          </div>

          <div className="mt-4 flex gap-2.5">
            <IconIdea
              aria-hidden="true"
              className="text-muted mt-0.5 size-3.5 shrink-0"
              strokeWidth={1.7}
            />
            <p className="text-muted text-[12.5px] leading-relaxed">
              {current.feedback}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
