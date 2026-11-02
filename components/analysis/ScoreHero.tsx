"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { SectionCard } from "@/components/shared/SectionCard";
import { ScoreArc } from "@/components/analysis/ScoreArc";
import { CategoryBreakdown } from "@/components/analysis/CategoryBreakdown";
import { VerdictLine } from "@/components/analysis/VerdictLine";
import type { CategoryScore } from "@/lib/analysis/scoring";

/**
 * The score hero — the first thing the anxious student sees.
 *
 * Left: the circular score arc. Right: the four category bars. Below the arc:
 * the verdict line. All three read from `scoring.ts` values passed in; the hero
 * computes nothing itself. `settled` is true only when the analysis is DONE, so
 * the number count-ups exactly once rather than jittering on every stream tick.
 */
export interface ScoreHeroProps {
  score: number | null;
  categories: readonly CategoryScore[];
  settled: boolean;
}

export function ScoreHero({ score, categories, settled }: ScoreHeroProps) {
  const t = useTranslations("analysis");

  return (
    /*
     * The almond gradient the landing page gives its feature tiles and the
     * dashboard gives its standing card. This is the report's equivalent —
     * the one card carrying the signature gauge — so it gets the same
     * treatment, and the report opens with something that reads as a hero
     * rather than as the first of six identical white boxes.
     */
    <SectionCard className="from-surface to-primary-soft/35 bg-linear-to-br">
      {/* Almond pill, matching every other section opener in the product. */}
      <p className="mb-5">
        <span className="bg-primary-soft text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-medium">
          <span
            aria-hidden="true"
            className="bg-primary size-1.5 rounded-full"
          />
          {t("score.eyebrow")}
        </span>
      </p>

      <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center sm:items-start">
          <ScoreArc score={score} settled={settled} />
          <div className="max-w-xs">
            <VerdictLine score={score} settled={settled} />
          </div>
        </div>

        <div className="border-border flex-1 sm:border-l sm:pl-8">
          <CategoryBreakdown categories={categories} />
        </div>
      </div>
    </SectionCard>
  );
}
