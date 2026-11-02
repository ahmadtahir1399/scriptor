"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { IconArrowRight, IconRequirements } from "@/components/icons";

/**
 * The extraction itself: a page of handbook prose on the left, the rules it
 * became on the right, and a live link between them.
 *
 * The first build of this section showed only the OUTPUT — a checklist of six
 * rules with tickboxes. Every product has a checklist. It said nothing about
 * the thing that is actually hard, which is that a faculty handbook is
 * paragraphs of hedged English and a gradeable requirement is not.
 *
 * So both sides are on screen and `requirements.source_quote` connects them.
 * Selecting a rule lights the clause it came from; selecting a clause lights
 * the rule it produced. Provenance in both directions, which is also the
 * honest answer to "how do I know it read my handbook right".
 *
 * ── The modal verb is the whole trick ─────────────────────────────────────
 * `is_mandatory` is not guessed from the rule's meaning — it comes from the
 * handbook's own wording. "shall", "must" and "is required to" make a rule
 * mandatory; "should" makes it advisory. Each card names the word it keyed on,
 * so the classification is auditable rather than asserted. That distinction is
 * load-bearing: a missed must can get a thesis returned unmarked, a missed
 * should cannot.
 *
 * ── Why pine and not honey ────────────────────────────────────────────────
 * The clause highlights use `.mark-rule` — pine. Extraction is STRUCTURE, not
 * a verdict. The honey/warning/AI washes in `AnchoredViewer` mean "something
 * is wrong here" and reusing them would say a handbook sentence is a problem.
 */

export interface DemoClause {
  id: string;
  /** Handbook numbering — real structure, not decoration. */
  num: string;
  before: string;
  mark: string;
  after: string;
}

export interface DemoRule {
  id: string;
  title: string;
  /** The handbook's own modal verb, which is what set `is_mandatory`. */
  trigger: string;
  mandatory: boolean;
  satisfied: boolean;
  evidence: string;
}

export interface RequirementsDemoProps {
  fileName: string;
  fileStatus: string;
  heading: string;
  rulesLabel: string;
  labels: {
    required: string;
    recommended: string;
    met: string;
    notMet: string;
    because: string;
  };
  clauses: readonly DemoClause[];
  rules: readonly DemoRule[];
}

export function RequirementsDemo({
  fileName,
  fileStatus,
  heading,
  rulesLabel,
  labels,
  clauses,
  rules,
}: RequirementsDemoProps) {
  const uid = React.useId();
  const [active, setActive] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);

  const lit = (id: string) => active === id || hovered === id;
  const ruleId = (id: string) => `${uid}-rule-${id}`;

  const bind = (id: string) => ({
    onClick: () => setActive((current) => (current === id ? null : id)),
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(id),
    onBlur: () => setHovered(null),
    "aria-pressed": active === id,
  });

  return (
    <div className="bg-surface border-border shadow-card overflow-hidden rounded-lg border">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr]">
        {/* ── The handbook, as submitted ─────────────────────────────── */}
        <div className="border-border border-b lg:border-r lg:border-b-0">
          <div className="border-border bg-bg/50 flex items-center gap-2.5 border-b px-4 py-3 sm:px-5">
            <IconRequirements
              aria-hidden="true"
              className="text-muted size-4 shrink-0"
              strokeWidth={1.7}
            />
            <span className="text-ink truncate text-[12.5px] font-medium">
              {fileName}
            </span>
            <Badge variant="verified" className="ml-auto shrink-0">
              {fileStatus}
            </Badge>
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <h3 className="display text-ink text-[14px] leading-snug">
              {heading}
            </h3>

            <div className="mt-4 flex flex-col gap-3">
              {clauses.map((clause) => (
                <p
                  key={clause.id}
                  className="prose-thesis text-ink flex gap-2.5 text-[12.5px] leading-[1.85]"
                >
                  <span className="text-muted shrink-0 tabular-nums">
                    {clause.num}
                  </span>
                  <span>
                    {clause.before}
                    <button
                      type="button"
                      {...bind(clause.id)}
                      aria-describedby={ruleId(clause.id)}
                      className="focus-visible:outline-primary cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <mark
                        className={cn(
                          "mark-wipe mark-rule text-ink transition-shadow duration-200",
                          lit(clause.id) &&
                            "shadow-[0_0_0_2px_var(--color-primary)]",
                        )}
                      >
                        {clause.mark}
                      </mark>
                    </button>
                    {clause.after}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ── What it became ─────────────────────────────────────────── */}
        <div className="bg-bg/25">
          <div className="border-border bg-bg/50 flex items-center gap-2.5 border-b px-4 py-3 sm:px-5">
            <IconArrowRight
              aria-hidden="true"
              className="text-primary size-4 shrink-0"
              strokeWidth={2}
            />
            <span className="text-ink text-[12.5px] font-medium">
              {rulesLabel}
            </span>
            <span className="display text-primary ml-auto text-[16px] leading-none tabular-nums">
              {rules.length}
            </span>
          </div>

          <ul className="divide-border divide-y">
            {rules.map((rule) => (
              <li key={rule.id}>
                <button
                  type="button"
                  {...bind(rule.id)}
                  className={cn(
                    "focus-visible:outline-primary relative w-full cursor-pointer px-4 py-3.5 pl-5 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-5 sm:pl-6",
                    lit(rule.id) ? "bg-primary-soft/30" : "hover:bg-primary-soft/15",
                  )}
                >
                  {/* Pine rail, not a status colour — it marks which rule you
                      are looking at, not how the thesis scored on it. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 transition-colors duration-200",
                      lit(rule.id) ? "bg-primary" : "bg-transparent",
                    )}
                  />

                  <span className="text-ink block text-[12.5px] leading-snug font-medium">
                    {rule.title}
                  </span>

                  <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span
                      className={cn(
                        "text-[10px] font-medium tracking-wide uppercase",
                        rule.mandatory ? "text-primary" : "text-muted",
                      )}
                    >
                      {rule.mandatory ? labels.required : labels.recommended}
                    </span>
                    {/* The audit trail for that classification: the handbook's
                        own word. Asserting "Required" without it would be the
                        model's opinion; naming the verb makes it checkable. */}
                    <span className="text-muted text-[10.5px]">
                      {labels.because}{" "}
                      <span className="prose-thesis text-ink">
                        “{rule.trigger}”
                      </span>
                    </span>
                  </span>

                  <span
                    id={ruleId(rule.id)}
                    className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5"
                  >
                    <Badge
                      variant={rule.satisfied ? "verified" : "critical"}
                      className="shrink-0"
                    >
                      {rule.satisfied ? labels.met : labels.notMet}
                    </Badge>
                    <span className="text-muted text-[11.5px] leading-relaxed">
                      {rule.evidence}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
