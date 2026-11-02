"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { DefenseQuestion } from "@/lib/db/queries/defense";
import type { PracticeQuestionState } from "@/hooks/usePractice";
import { SectionCard } from "@/components/shared/SectionCard";
import { ButtonLink } from "@/components/ui/button-link";
import { StartPracticeButton } from "@/components/defense/StartPracticeButton";

/**
 * End-of-session summary: how many were attempted, a calm read of how it went by
 * verdict, and the two next moves — practise again, or back to the questions.
 */
export interface PracticeSummaryProps {
  analysisId: string;
  questions: readonly DefenseQuestion[];
  stateFor: (questionId: string) => PracticeQuestionState;
}

export function PracticeSummary({
  analysisId,
  questions,
  stateFor,
}: PracticeSummaryProps) {
  const t = useTranslations("defense.summary");

  const tally = React.useMemo(() => {
    let attempted = 0;
    let strong = 0;
    let adequate = 0;
    let needsWork = 0;
    for (const question of questions) {
      const state = stateFor(question.id);
      if (!state.answered) continue;
      attempted += 1;
      if (state.feedback?.verdict === "strong") strong += 1;
      else if (state.feedback?.verdict === "adequate") adequate += 1;
      else if (state.feedback?.verdict === "needs_work") needsWork += 1;
    }
    return { attempted, strong, adequate, needsWork };
  }, [questions, stateFor]);

  const readKey =
    tally.needsWork > tally.strong
      ? "read.mixed"
      : tally.attempted > 0
        ? "read.solid"
        : "read.none";

  return (
    <SectionCard>
      <div className="space-y-4">
        <div>
          <p className="text-section-title text-ink">{t("title")}</p>
          <p className="text-body text-muted mt-1">
            {t("attempted", {
              attempted: tally.attempted,
              total: questions.length,
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Stat label={t("strong")} value={tally.strong} tone="text-verified" />
          <Stat
            label={t("adequate")}
            value={tally.adequate}
            tone="text-muted"
          />
          <Stat
            label={t("needsWork")}
            value={tally.needsWork}
            tone="text-warning"
          />
        </div>

        <p className="text-body text-ink">{t(readKey)}</p>

        <div className="flex flex-wrap items-center gap-2">
          <StartPracticeButton analysisId={analysisId} />
          <ButtonLink
            href={`/analysis/${analysisId}/defense`}
            variant="outline"
          >
            {t("backToQuestions")}
          </ButtonLink>
        </div>
      </div>
    </SectionCard>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div>
      <p className="text-micro text-muted uppercase">{label}</p>
      <p className={`text-page-title tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
