"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconChevronDown, IconIdea } from "@/components/icons";

import { cn } from "@/lib/utils";
import type { DefenseQuestion } from "@/lib/db/queries/defense";
import { parseReferenceAnswer } from "@/lib/defense/practice";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/defense/DifficultyBadge";

/**
 * One predicted question. The model answer is HIDDEN by default so the student
 * thinks first; "Why they ask this" and "Show model answer" reveal on demand.
 * The question is set in serif for gravitas — it's what an examiner would say.
 */
export interface DefenseQuestionCardProps {
  question: DefenseQuestion;
}

export function DefenseQuestionCard({ question }: DefenseQuestionCardProps) {
  const t = useTranslations("defense");
  const reference = parseReferenceAnswer(question.reference_answer);
  const [showWhy, setShowWhy] = React.useState(false);
  const [showAnswer, setShowAnswer] = React.useState(false);

  return (
    <SectionCard>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-body text-ink"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {question.question}
          </p>
          <DifficultyBadge difficulty={question.difficulty} />
        </div>

        {question.source_quote ? (
          <p className="text-meta text-muted border-border border-l-2 pl-3 italic">
            {t("card.fromThesis", { quote: question.source_quote })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {reference.explanation ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWhy((value) => !value)}
            >
              <IconChevronDown
                className={cn("transition-transform", showWhy && "rotate-180")}
                aria-hidden="true"
              />
              {t("card.whyAsk")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnswer((value) => !value)}
          >
            <IconIdea aria-hidden="true" />
            {showAnswer ? t("card.hideAnswer") : t("card.showAnswer")}
          </Button>
        </div>

        {showWhy && reference.explanation ? (
          <p className="text-meta text-muted bg-bg rounded-md p-3">
            {reference.explanation}
          </p>
        ) : null}

        {showAnswer ? (
          <div className="bg-primary-soft/40 space-y-3 rounded-md p-4">
            <div>
              <p className="text-micro text-muted uppercase">
                {t("card.modelAnswer")}
              </p>
              <p className="text-body text-ink mt-1 whitespace-pre-line">
                {reference.answer}
              </p>
            </div>
            {reference.keyPoints.length > 0 ? (
              <div>
                <p className="text-micro text-muted uppercase">
                  {t("card.keyPoints")}
                </p>
                <ul className="text-meta text-ink mt-1 list-disc space-y-1 pl-5">
                  {reference.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
