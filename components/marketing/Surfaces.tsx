import * as React from "react";

import { cn } from "@/lib/utils";
import { ScoreArc } from "@/components/analysis/ScoreArc";
import { StatusPill } from "@/components/shared/StatusPill";
import { IconCheck, IconLink } from "@/components/icons";

/**
 * The specimen sheet for the drift gallery.
 *
 * Colocated in one file on purpose: individually these are meaningless — a
 * finding card with no analysis behind it is not a component anyone would
 * import — and collectively they are one artefact, the set of surfaces the
 * gallery shows. Splitting them into seven files would imply a reusability
 * they do not have.
 *
 * ── What is real and what is a specimen ──────────────────────────────────
 * REAL, rendered from the product with fixture props:
 *   `ScoreArc`   — pure presentation, takes `score`/`settled`, draws with the
 *                  same `.arc-draw` CSS the report uses.
 *   `StatusPill` — the product's own four-state pill.
 *
 * SPECIMENS, sharing the tokens and classes but not the data layer: the
 * finding, reference, defense and todo cards. Their real counterparts are
 * bound to react-query and a live analysis, and wiring a marketing page into
 * that would mean either shipping the query layer to an anonymous visitor or
 * faking a session. They reuse `.prose-thesis`, `bg-highlight`, the soft-pill
 * status contract and the same card chrome, so they drift out of sync with the
 * product only if the tokens do.
 *
 * ── Motion ───────────────────────────────────────────────────────────────
 * These stay Server Components. Each part is tagged with a `data-reveal`
 * attribute and `RevealOnView` drives the timeline from the client when the
 * card reaches the viewport. Every animated element is authored in its FINAL
 * state — the transforms below are the resting values, not starting ones — so
 * with JavaScript off, or under reduced motion, the cards are simply correct.
 *
 * Every string arrives as a prop. These components never reach for a
 * translation themselves, so the gallery owns the copy in one place and each
 * surface stays a pure function of what it is handed.
 */

type Tone = "critical" | "warning" | "verified" | "ai";

const TONE_PILL: Record<Tone, string> = {
  critical: "bg-critical-soft text-critical",
  warning: "bg-warning-soft text-warning",
  verified: "bg-verified-soft text-verified",
  ai: "bg-ai-soft text-ai",
};

const TONE_RULE: Record<Tone, string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  verified: "bg-verified",
  ai: "bg-ai",
};

/** Shared card chrome. One radius, one border, one shadow, everywhere. */
function Surface({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div
      className={cn(
        "bg-surface border-border shadow-card overflow-hidden rounded-md border",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Soft pill + label. Colour reinforces the word; it never replaces it. */
function Pill({
  tone,
  children,
  className,
}: Readonly<{ tone: Tone; children: React.ReactNode; className?: string }>) {
  return (
    <span
      data-reveal="pop"
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap",
        TONE_PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface FindingSurfaceProps {
  page: string;
  check: string;
  severity: string;
  tone: Tone;
  before: string;
  mark: string;
  after: string;
  title: string;
}

/**
 * The anchoring, at gallery scale — a quoted sentence with a honey wash on the
 * offending span and the finding attached beneath it by a coloured rule.
 *
 * The wash is a layer inside `<mark>` rather than the element's own
 * background, so it can wipe in from the left while the semantics of `<mark>`
 * are preserved for assistive tech.
 */
export function FindingSurface({
  page,
  check,
  severity,
  tone,
  before,
  mark,
  after,
  title,
}: FindingSurfaceProps) {
  return (
    <Surface>
      <div className="border-border flex items-center gap-2 border-b px-3.5 py-2.5">
        <span
          data-reveal="fade"
          className="text-muted text-[11px] tabular-nums"
        >
          {page}
        </span>
        <span aria-hidden="true" className="bg-border h-2.5 w-px" />
        <span data-reveal="fade" className="text-muted truncate text-[11px]">
          {check}
        </span>
        <Pill tone={tone} className="ml-auto">
          {severity}
        </Pill>
      </div>

      <div className="px-3.5 py-3">
        <p
          data-reveal="fade"
          className="prose-thesis text-ink text-[13px] leading-[1.7]"
        >
          {before}
          <mark className="text-ink relative inline-block bg-transparent">
            <span
              data-reveal="wipe"
              aria-hidden="true"
              className="bg-highlight absolute inset-x-0 inset-y-[-0.1em] origin-left rounded-[2px]"
            />
            <span className="relative">{mark}</span>
          </mark>
          {after}
        </p>

        <div className="relative mt-3 pl-3">
          <span
            data-reveal="draw"
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 left-0 w-0.5 origin-top rounded-full",
              TONE_RULE[tone],
            )}
          />
          <h3
            data-reveal="fade"
            className="display text-ink text-[12.5px] leading-snug"
          >
            {title}
          </h3>
        </div>
      </div>
    </Surface>
  );
}

/**
 * A bibliography entry and its verification result. `UNCHECKED` and
 * `NOT_FOUND` are genuinely different states in the schema, so the label is
 * always spelled out rather than encoded in the pill's colour.
 */
export function ReferenceSurface({
  citation,
  health,
  tone,
}: Readonly<{ citation: string; health: string; tone: Tone }>) {
  return (
    <Surface className="px-3.5 py-3.5">
      <div className="flex items-start gap-2.5">
        <IconLink
          aria-hidden="true"
          className="text-muted mt-0.5 size-3.5 shrink-0"
          strokeWidth={1.7}
        />
        <div className="min-w-0">
          <p data-reveal="fade" className="text-ink text-[12px] leading-relaxed">
            {citation}
          </p>
          <Pill tone={tone} className="mt-2 inline-block">
            {health}
          </Pill>
        </div>
      </div>
    </Surface>
  );
}

/**
 * One check's result. Uses the product's real `StatusPill`, and the bar is the
 * "thin accent beside a label" case — the score is written next to it.
 *
 * The fill's resting transform is authored inline and `data-fill` tells the
 * reveal what to animate up to, so the bar is at its true width before any
 * JavaScript runs.
 */
export function CheckSurface({
  name,
  score,
}: Readonly<{ name: string; score: number }>) {
  const fill = score / 100;

  return (
    <Surface className="px-3.5 py-3.5">
      <div className="flex items-center gap-2">
        <span data-reveal="fade" className="text-ink truncate text-[12.5px]">
          {name}
        </span>
        <span data-reveal="pop" className="ml-auto shrink-0">
          <StatusPill status="DONE" size="sm" />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <div className="bg-primary-soft h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            data-reveal="wipe"
            data-fill={fill}
            className="bg-verified h-full w-full origin-left rounded-full"
            style={{ transform: `scaleX(${fill})` }}
          />
        </div>
        <span
          data-reveal="fade"
          className="text-muted text-[11px] tabular-nums"
        >
          {score}
        </span>
      </div>
    </Surface>
  );
}

/** A question the committee is likely to ask, in the student's own serif. */
export function DefenseSurface({
  label,
  question,
  difficulty,
  tone,
}: Readonly<{
  label: string;
  question: string;
  difficulty: string;
  tone: Tone;
}>) {
  return (
    <Surface className="px-3.5 py-3.5">
      <span data-reveal="fade" className="eyebrow text-muted text-[10px]">
        {label}
      </span>
      <p
        data-reveal="fade"
        className="prose-thesis text-ink mt-2 text-[13px] leading-[1.7]"
      >
        {question}
      </p>
      <Pill tone={tone} className="mt-3 inline-block">
        {difficulty}
      </Pill>
    </Surface>
  );
}

/** The revision list. One item struck through, because progress is the point. */
export function TodoSurface({
  label,
  items,
}: Readonly<{
  label: string;
  items: readonly { text: string; done: boolean }[];
}>) {
  return (
    <Surface className="px-3.5 py-3.5">
      <span data-reveal="fade" className="eyebrow text-muted text-[10px]">
        {label}
      </span>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5">
            <span
              data-reveal={item.done ? "pop" : undefined}
              aria-hidden="true"
              className={cn(
                "mt-px flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border",
                item.done
                  ? "bg-verified border-verified"
                  : "border-border bg-transparent",
              )}
            >
              {item.done ? (
                <IconCheck
                  className="text-verified-foreground size-2.5"
                  strokeWidth={3}
                />
              ) : null}
            </span>
            <span
              data-reveal="fade"
              className={cn(
                "text-[12px] leading-snug",
                item.done ? "text-muted line-through" : "text-ink",
              )}
            >
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

/**
 * The signature gauge, rendered by the product's own component.
 *
 * No `data-reveal` on the arc itself — it animates through `.arc-draw` and
 * `.count-up` in `globals.css`, which `RevealOnView` releases via `.await-view`
 * when the card lands. Driving it twice would fight those keyframes.
 */
export function ScoreSurface({
  score,
  caption,
}: Readonly<{ score: number; caption: string }>) {
  return (
    <Surface className="flex flex-col items-center px-3.5 py-5">
      <ScoreArc score={score} settled size={126} />
      <p
        data-reveal="fade"
        className="text-muted mt-3 text-center text-[11.5px] leading-relaxed"
      >
        {caption}
      </p>
    </Surface>
  );
}
