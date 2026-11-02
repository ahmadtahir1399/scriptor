"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import type { JobStatus } from "@/lib/db/enums";
import type { PaperCardView } from "@/lib/papers/presentation";
import { scoreTone, type ScoreTone } from "@/lib/analysis/presentation";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/shared/StatusPill";
import { ScoreChip } from "@/components/papers/ScoreChip";
import { ScoreSparkline } from "@/components/papers/ScoreSparkline";
import { PaperActionsMenu } from "@/components/papers/PaperActionsMenu";

/**
 * One paper in the library.
 *
 * ── IT IS THE LANDING PAGE'S BENTO TILE ──────────────────────────────────────
 *
 * Deliberately, class for class: the same `rounded-lg` / `shadow-card` / `lift`
 * chrome, the same `hover:border-primary/35`, the same rule down the left edge,
 * and the same `p-5 pl-6` that leaves room for it. `CheckCatalogue` is where
 * that vocabulary is authored; this is the app screen a visitor lands on
 * straight after it, and the two should not look like different products.
 *
 * The one thing NOT carried across is the tiles' `from-surface
 * to-primary-soft/35` wash. It works there because that section stands on
 * `bg-green-050`; the library stands on linen, which the wash's far corner is
 * close enough to that the card visibly loses its own edge. Cream on linen,
 * with the shadow doing the separating, is what keeps it crisp.
 *
 * The title moved to `display text-primary` for the same reason `CardTitle`
 * did — pine at `text-section-title` is what every tile heading in the
 * marketing sections is, and it costs nothing in contrast (11.64:1 on surface).
 *
 * ── THE LEFT RULE CARRIES THE VERDICT; PINE MEANS "NO VERDICT" ───────────────
 *
 * A left border is one of the three thin accents the design contract lets a
 * solid `verified`/`warning`/`critical` occupy, on the condition that a text
 * label sits beside it. The `ScoreChip` in the footer — a soft pill with the
 * number and the words "Current score" — is that label, so the rule reinforces
 * and never replaces it.
 *
 * When there is no score yet the rule falls back to `primary`, because "this
 * has not been reviewed" is a system state, not a grade. That is the same
 * reason the catalogue's rule is pine: a pine edge means "this is chrome".
 *
 * ── WHY THE SCORE LEFT THE TITLE ROW ────────────────────────────────────────
 *
 * It used to sit beside the title with the ⋯ menu, which gave a long name about
 * half the card to live in — an untitled paper falls back to its id, and the
 * row rendered as a truncated UUID with a number jammed against it. The heading
 * now owns the full width and clamps to two lines; the score anchors the footer
 * beside its sparkline, where it reads as data rather than as an ornament on
 * the name.
 *
 * The entrance stagger is `.rise-stagger` on the grid plus an inline `--i`
 * here — same motion as the old framer-motion version, no animation library on
 * the app's landing screen. `index` survives only to feed that variable.
 */
export interface PaperCardProps {
  paper: PaperCardView;
  index: number;
}

/**
 * The left rule's colour. `muted` — an unscored paper — resolves to pine
 * rather than a grey, so an unreviewed card reads as chrome instead of as a
 * fourth, unexplained verdict.
 */
const RULE_TONE: Record<ScoreTone, string> = {
  verified: "bg-verified",
  warning: "bg-warning",
  critical: "bg-critical",
  muted: "bg-primary",
};

function formatDocType(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function PaperCard({ paper, index }: PaperCardProps) {
  const t = useTranslations("papers");
  const format = useFormatter();

  const href = paper.currentAnalysisId
    ? `/analysis/${paper.currentAnalysisId}`
    : `/upload?paperId=${paper.paperId}`;
  const title = paper.title || t("untitled");
  const failed = paper.currentStatus === "ERROR";
  const running = paper.currentStatus === "GENERATING" || failed;

  // A failed run is a problem whatever the last score was, and the StatusPill
  // rendered beside the rule spells that out — so the rule follows the failure.
  const tone: ScoreTone = failed ? "critical" : scoreTone(paper.currentScore);

  return (
    <div
      className="relative"
      // Capped so a long library does not make the last card wait a second.
      style={{ "--i": Math.min(index, 11) } as React.CSSProperties}
    >
      <Card className="lift hover:border-primary/35 relative flex h-full flex-col overflow-hidden p-5 pl-6 transition-colors">
        <span
          aria-hidden="true"
          className={cn("absolute inset-y-0 left-0 w-0.5", RULE_TONE[tone])}
        />

        {/* The whole card is the link. Only the ⋯ menu opts back into pointer
            events, so a click anywhere else opens the report. */}
        <Link
          href={href}
          className="absolute inset-0 z-0 rounded-lg"
          aria-label={t("openReview")}
        />

        <div className="pointer-events-none relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            {paper.documentTypeCode ? (
              <span className="bg-primary-soft text-primary text-micro inline-block rounded-full px-2.5 py-1 font-medium tracking-normal">
                {formatDocType(paper.documentTypeCode)}
              </span>
            ) : null}
            {/*
             * `line-clamp-2`, not `truncate`. Paper names are sentences and the
             * fallback for an unnamed one is a uuid; a single truncated line
             * shows neither the beginning of a long title nor enough of an id
             * to tell two apart.
             */}
            <h3
              className={cn(
                "display text-section-title text-primary line-clamp-2",
                paper.documentTypeCode && "mt-2.5",
              )}
            >
              {title}
            </h3>
          </div>

          {/* Pulled into the padding so the glyph optically aligns with the
              card's edges rather than sitting a button's worth of air inside. */}
          <div className="pointer-events-auto relative z-10 -mt-1.5 -mr-1.5 shrink-0">
            <PaperActionsMenu
              paperId={paper.paperId}
              title={title}
              currentAnalysisId={paper.currentAnalysisId}
            />
          </div>
        </div>

        {/* `mt-auto` pins the footer to the bottom edge, so every card in a row
            agrees on where its score sits however long the title ran — the same
            trick the catalogue tiles use for their mode pill. */}
        <div className="pointer-events-none relative mt-auto pt-5">
          <div className="border-border/70 flex items-center justify-between gap-3 border-t pt-3.5">
            {running && paper.currentStatus ? (
              <StatusPill status={paper.currentStatus as JobStatus} size="sm" />
            ) : (
              <div className="flex items-baseline gap-2">
                <ScoreChip score={paper.currentScore} />
                <span className="text-meta text-muted">
                  {t("trend.currentScore")}
                </span>
              </div>
            )}

            {paper.scores.length >= 2 ? (
              <ScoreSparkline
                scores={paper.scores.map((point) => point.score)}
              />
            ) : null}
          </div>

          <div className="text-meta text-muted mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <span>{t("versionsCount", { count: paper.versionCount })}</span>
            {/* The hairline separator the marketing surfaces use between meta
                items, rather than a middot — it is quieter at 13px. */}
            <span aria-hidden="true" className="bg-border h-2.5 w-px" />
            <span>{format.relativeTime(new Date(paper.updatedAt))}</span>

            {paper.openIssues > 0 ? (
              // A soft pill with the count spelled out, which is the contract's
              // status shape — the old bare clay text was a colour doing a
              // label's job. `ml-auto` parks it opposite the meta, and on a
              // narrow card it wraps to its own right-aligned line.
              <span className="bg-critical-soft text-critical text-micro ml-auto rounded-full px-2.5 py-1 font-medium tracking-normal">
                {t("openIssues", { count: paper.openIssues })}
              </span>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
