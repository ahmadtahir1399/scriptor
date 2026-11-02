"use client";

import * as React from "react";

import type { PracticeData } from "@/lib/defense/actions";
import { finishPractice, skipAnswer, submitAnswer } from "@/lib/defense/actions";
import type { DefenseQuestion } from "@/lib/db/queries/defense";
import { parseFeedback } from "@/lib/defense/practice";
import type { AnswerFeedbackData } from "@/lib/validations/defense";

/**
 * Drives one practice session client-side.
 *
 * The session walks the analysis's questions one at a time; answers are
 * persisted server-side (with model feedback) and mirrored into local state so
 * the feedback and model answer reveal instantly after submitting. Seeded from
 * the server so a resumed session shows prior answers.
 */
export interface PracticeQuestionState {
  answered: boolean;
  skipped: boolean;
  answerText: string;
  feedback: AnswerFeedbackData | null;
}

export interface UsePracticeValue {
  questions: DefenseQuestion[];
  index: number;
  current: DefenseQuestion | undefined;
  stateFor: (questionId: string) => PracticeQuestionState;
  answeredCount: number;
  isPending: boolean;
  submit: (answer: string) => Promise<void>;
  skip: () => Promise<void>;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  finish: () => Promise<void>;
}

const EMPTY_STATE: PracticeQuestionState = { answered: false, skipped: false, answerText: "", feedback: null };

export function usePractice(initial: PracticeData): UsePracticeValue {
  const practiceId = initial.practice.id;
  const questions = React.useMemo(
    () => initial.groups.flatMap((group) => group.questions),
    [initial.groups],
  );

  const [states, setStates] = React.useState<Record<string, PracticeQuestionState>>(() => {
    const seed: Record<string, PracticeQuestionState> = {};
    for (const answer of initial.answers) {
      const skipped = answer.answer_text.trim() === "" && answer.feedback === null;
      seed[answer.defense_question_id] = {
        answered: true,
        skipped,
        answerText: answer.answer_text,
        feedback: parseFeedback(answer.feedback),
      };
    }
    return seed;
  });

  const firstUnanswered = questions.findIndex((question) => !states[question.id]?.answered);
  const [index, setIndex] = React.useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [isPending, setIsPending] = React.useState(false);

  const current = questions[index];
  const answeredCount = Object.values(states).filter((state) => state.answered).length;

  const stateFor = React.useCallback(
    (questionId: string): PracticeQuestionState => states[questionId] ?? EMPTY_STATE,
    [states],
  );

  const submit = React.useCallback(
    async (answer: string): Promise<void> => {
      if (!current) return;
      setIsPending(true);
      const result = await submitAnswer({ practiceId, questionId: current.id, answer });
      setIsPending(false);
      if (result.ok) {
        setStates((prev) => ({
          ...prev,
          [current.id]: { answered: true, skipped: false, answerText: answer, feedback: result.feedback },
        }));
      }
    },
    [current, practiceId],
  );

  const skip = React.useCallback(async (): Promise<void> => {
    if (!current) return;
    setIsPending(true);
    const result = await skipAnswer({ practiceId, questionId: current.id });
    setIsPending(false);
    if (result.ok) {
      setStates((prev) => ({
        ...prev,
        [current.id]: { answered: true, skipped: true, answerText: "", feedback: null },
      }));
    }
  }, [current, practiceId]);

  const goTo = React.useCallback(
    (target: number) => setIndex(Math.max(0, Math.min(questions.length - 1, target))),
    [questions.length],
  );

  const next = React.useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = React.useCallback(() => goTo(index - 1), [goTo, index]);
  const finish = React.useCallback(() => finishPractice({ practiceId }).then(() => undefined), [practiceId]);

  return { questions, index, current, stateFor, answeredCount, isPending, submit, skip, goTo, next, prev, finish };
}
