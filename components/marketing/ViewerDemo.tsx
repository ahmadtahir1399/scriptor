"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { IconFindings, IconSearch } from "@/components/icons";

/**
 * The viewer, actually usable.
 *
 * The real `DocumentViewer` binds a highlight to its sidebar entry in both
 * directions — hover or click either one and the other responds. That linking
 * IS the product's core interaction, so a static picture of it undersells the
 * thing the whole section is about. This reproduces exactly that much and
 * nothing else: no zoom, no page turning, no filters. A demo that tries to be
 * the app ends up being a worse app.
 *
 * State is deliberately two values, not one. `active` survives until something
 * else is chosen (a click is a decision); `hovered` is transient. "Lit" is
 * either — which means a mouse user gets preview-on-hover and a keyboard user
 * gets the same response from focus, without a second code path.
 *
 * ── Accessibility ─────────────────────────────────────────────────────────
 * Highlights are real `<button>`s, so they are tabbable and operable by
 * keyboard for free. Each is `aria-describedby` its sidebar note, so a screen
 * reader user who lands on a highlight hears what is wrong with it rather than
 * just the quoted words. `aria-pressed` carries selection state. Nothing here
 * depends on colour: every finding names its own type in words.
 *
 * ── Motion ────────────────────────────────────────────────────────────────
 * The wash wipes in via `.mark-wipe` (CSS), which `RevealOnView` holds with
 * `.await-view` until the panel arrives. Selection is a CSS transition on
 * outline and shadow only — never on the wash's own animation, which would
 * fight the keyframe.
 */

export type DemoTone = "grammar" | "content" | "ai";

export interface DemoFinding {
  id: string;
  tone: DemoTone;
  /** Named in words — the colour never carries the verdict alone. */
  type: string;
  quote: string;
  note: string;
  before: string;
  mark: string;
  after: string;
}

export interface ViewerDemoProps {
  page: string;
  zoom: string;
  findingCount: string;
  sidebar: string;
  heading: string;
  hint: string;
  findings: readonly DemoFinding[];
}

/** Mirrors `components/viewer/HighlightBox.tsx`; the colours live in css. */
const TONE_MARK: Record<DemoTone, string> = {
  grammar: "mark-grammar",
  content: "mark-content",
  ai: "mark-ai",
};

const TONE_RULE: Record<DemoTone, string> = {
  grammar: "bg-warning",
  content: "bg-critical",
  ai: "bg-ai",
};

const TONE_LABEL: Record<DemoTone, string> = {
  grammar: "text-warning",
  content: "text-critical",
  ai: "text-ai",
};

export function ViewerDemo({
  page,
  zoom,
  findingCount,
  sidebar,
  heading,
  hint,
  findings,
}: ViewerDemoProps) {
  const uid = React.useId();
  const [active, setActive] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);

  const noteId = (id: string) => `${uid}-${id}-note`;
  const isLit = (id: string) => active === id || hovered === id;

  return (
    <div className="bg-surface border-border shadow-card overflow-hidden rounded-lg border">
      {/* Toolbar */}
      <div className="border-border bg-primary-soft/30 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5">
        <span className="text-muted text-[11.5px] tabular-nums">{page}</span>
        <span aria-hidden="true" className="bg-border h-3 w-px" />
        <span className="text-muted flex items-center gap-1.5 text-[11.5px]">
          <IconSearch aria-hidden="true" className="size-3.5" strokeWidth={1.7} />
          {zoom}
        </span>
        <span
          data-reveal="pop"
          className="bg-primary text-primary-foreground ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
        >
          <IconFindings aria-hidden="true" className="size-3" strokeWidth={2} />
          {findingCount}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[76px_1fr_280px]">
        {/* Thumbnail rail. Presentational — it shows position, and giving it
            hover affordances it does not honour would be a lie. */}
        <div
          aria-hidden="true"
          className="border-border hidden flex-col gap-2 border-r p-3 lg:flex"
        >
          {[46, 47, 48, 49].map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "bg-bg aspect-[1/1.414] w-full rounded-[3px] border",
                  n === 47
                    ? "border-primary ring-primary/30 ring-2"
                    : "border-border",
                )}
              />
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  n === 47 ? "text-primary font-medium" : "text-muted",
                )}
              >
                {n}
              </span>
            </div>
          ))}
        </div>

        {/* The page. `.prose-thesis` — this is the student's writing, and the
            type system says whose words are on screen. */}
        <div className="bg-bg/40 px-5 py-6 lg:px-9 lg:py-9">
          <article className="bg-surface border-border shadow-card mx-auto max-w-[58ch] rounded-[4px] border px-6 py-7 lg:px-9 lg:py-9">
            <h3 className="display text-ink text-[15px] leading-snug">
              {heading}
            </h3>

            {findings.map((finding) => (
              <p
                key={finding.id}
                className="prose-thesis text-ink mt-4 text-[13.5px] leading-[1.9]"
              >
                {finding.before}
                <button
                  type="button"
                  aria-pressed={active === finding.id}
                  aria-describedby={noteId(finding.id)}
                  onClick={() =>
                    setActive((current) =>
                      current === finding.id ? null : finding.id,
                    )
                  }
                  onMouseEnter={() => setHovered(finding.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(finding.id)}
                  onBlur={() => setHovered(null)}
                  className="focus-visible:outline-primary cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <mark
                    className={cn(
                      "mark-wipe text-ink transition-shadow duration-200",
                      TONE_MARK[finding.tone],
                      // A ring rather than a colour change: the wash already
                      // encodes which check found it, so selection has to be
                      // a different channel or the two overwrite each other.
                      isLit(finding.id) &&
                        "shadow-[0_0_0_2px_var(--color-primary)]",
                    )}
                  >
                    {finding.mark}
                  </mark>
                </button>
                {finding.after}
              </p>
            ))}
          </article>
        </div>

        {/* Findings sidebar */}
        <div className="border-border flex flex-col gap-2.5 border-t p-3.5 lg:border-t-0 lg:border-l">
          <div className="flex items-baseline justify-between gap-2">
            <span className="eyebrow text-muted text-[10px]">{sidebar}</span>
          </div>

          {findings.map((finding) => (
            <button
              key={finding.id}
              type="button"
              aria-pressed={active === finding.id}
              onClick={() =>
                setActive((current) =>
                  current === finding.id ? null : finding.id,
                )
              }
              onMouseEnter={() => setHovered(finding.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(finding.id)}
              onBlur={() => setHovered(null)}
              className={cn(
                "focus-visible:outline-primary relative cursor-pointer rounded-md border py-2.5 pr-3 pl-3.5 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2",
                isLit(finding.id)
                  ? "border-primary/45 bg-primary-soft/35"
                  : "border-border bg-bg/40 hover:border-primary/25",
              )}
            >
              <span
                data-reveal="draw"
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-2 left-0 w-0.5 origin-top rounded-full",
                  TONE_RULE[finding.tone],
                )}
              />
              <span
                data-reveal="fade"
                className={cn(
                  "block text-[10px] font-medium tracking-wide uppercase",
                  TONE_LABEL[finding.tone],
                )}
              >
                {finding.type}
              </span>
              <span
                data-reveal="fade"
                className="prose-thesis text-ink mt-1 block text-[11.5px] leading-snug"
              >
                {finding.quote}
              </span>
              <span
                id={noteId(finding.id)}
                data-reveal="fade"
                className="text-muted mt-1.5 block text-[11px] leading-relaxed"
              >
                {finding.note}
              </span>
            </button>
          ))}

          <p className="text-muted mt-1 text-[10.5px] leading-relaxed">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}
