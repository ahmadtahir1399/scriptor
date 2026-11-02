"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconSend, IconSkip } from "@/components/icons";

import type { DefenseQuestion } from "@/lib/db/queries/defense";
import type { PracticeQuestionState } from "@/hooks/usePractice";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * The focused answer surface: the question, a large textarea, and Submit / Skip.
 * Once answered it becomes read-only (the answer is shown), and the feedback and
 * model answer reveal below it.
 */
export interface PracticeQuestionProps {
  question: DefenseQuestion;
  state: PracticeQuestionState;
  isPending: boolean;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
}

export function PracticeQuestion({
  question,
  state,
  isPending,
  onSubmit,
  onSkip,
}: PracticeQuestionProps) {
  const t = useTranslations("defense.practice");
  const [answer, setAnswer] = React.useState(state.answerText);
  const [lastQuestionId, setLastQuestionId] = React.useState(question.id);

  // Reset the textarea when navigating to a different question — adjusting state
  // during render on a prop change, React's recommended pattern over an effect.
  if (question.id !== lastQuestionId) {
    setLastQuestionId(question.id);
    setAnswer(state.answerText);
  }

  const trimmed = answer.trim();

  return (
    <SectionCard>
      <div className="space-y-4">
        <p
          className="text-section-title text-ink"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {question.question}
        </p>

        {state.answered ? (
          state.skipped ? (
            <p className="text-meta text-muted italic">{t("skipped")}</p>
          ) : (
            <div className="bg-bg rounded-md p-3">
              <p className="text-micro text-muted uppercase">
                {t("yourAnswer")}
              </p>
              <p className="text-body text-ink mt-1 whitespace-pre-line">
                {state.answerText}
              </p>
            </div>
          )
        ) : (
          <>
            <Textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={t("placeholder")}
              rows={6}
              disabled={isPending}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={() => onSubmit(trimmed)}
                disabled={isPending || trimmed.length === 0}
              >
                <IconSend aria-hidden="true" />
                {isPending ? t("submitting") : t("submit")}
              </Button>
              <Button variant="ghost" onClick={onSkip} disabled={isPending}>
                <IconSkip aria-hidden="true" />
                {t("skip")}
              </Button>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}
