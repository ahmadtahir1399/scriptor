"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconArrowRight } from "@/components/icons";

import type { PracticeData } from "@/lib/defense/actions";
import { usePractice } from "@/hooks/usePractice";
import { parseReferenceAnswer } from "@/lib/defense/practice";
import { SectionCard } from "@/components/shared/SectionCard";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { PracticeQuestion } from "@/components/defense/PracticeQuestion";
import { AnswerFeedback } from "@/components/defense/AnswerFeedback";
import { PracticeSummary } from "@/components/defense/PracticeSummary";

/**
 * One practice session — focused, exam-like chrome, but supportive. Walks the
 * questions one at a time; on submit the feedback and the model answer reveal
 * for comparison. The last question finishes the session into a summary.
 */
export interface PracticeViewProps {
  initial: PracticeData;
}

export function PracticeView({ initial }: PracticeViewProps) {
  const t = useTranslations("defense.practice");
  const practice = usePractice(initial);
  const [finished, setFinished] = React.useState(
    initial.practice.completed_at !== null,
  );

  if (practice.questions.length === 0) {
    return (
      <SectionCard>
        <p className="text-body text-muted">{t("noQuestions")}</p>
      </SectionCard>
    );
  }

  if (finished) {
    return (
      <PracticeSummary
        analysisId={initial.analysisId}
        questions={practice.questions}
        stateFor={practice.stateFor}
      />
    );
  }

  const current = practice.current;
  if (!current) return null;

  const state = practice.stateFor(current.id);
  const reference = parseReferenceAnswer(current.reference_answer);
  const isLast = practice.index === practice.questions.length - 1;
  const percent = Math.round(
    (practice.answeredCount / practice.questions.length) * 100,
  );

  const onFinish = async (): Promise<void> => {
    await practice.finish();
    setFinished(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <ButtonLink
          href={`/analysis/${initial.analysisId}/defense`}
          variant="ghost"
          size="sm"
        >
          <IconArrowRight aria-hidden="true" />
          {t("exit")}
        </ButtonLink>
        <span className="text-meta text-muted">
          {t("counter", {
            current: practice.index + 1,
            total: practice.questions.length,
          })}
        </span>
        <Progress value={percent} className="h-1.5 flex-1" />
      </div>

      <PracticeQuestion
        question={current}
        state={state}
        isPending={practice.isPending}
        onSubmit={practice.submit}
        onSkip={practice.skip}
      />

      {state.answered && !state.skipped && state.feedback ? (
        <AnswerFeedback feedback={state.feedback} />
      ) : null}

      {state.answered ? (
        <SectionCard>
          <div className="space-y-3">
            <div>
              <p className="text-micro text-muted uppercase">
                {t("modelAnswer")}
              </p>
              <p className="text-body text-ink mt-1 whitespace-pre-line">
                {reference.answer}
              </p>
            </div>
            {reference.keyPoints.length > 0 ? (
              <div>
                <p className="text-micro text-muted uppercase">
                  {t("keyPoints")}
                </p>
                <ul className="text-meta text-ink mt-1 list-disc space-y-1 pl-5">
                  {reference.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={practice.prev}
          disabled={practice.index === 0}
        >
          {t("previous")}
        </Button>
        {isLast ? (
          <Button onClick={() => void onFinish()}>{t("finish")}</Button>
        ) : (
          <Button onClick={practice.next}>{t("next")}</Button>
        )}
      </div>
    </div>
  );
}
