import { z } from "zod";

import { uuidSchema } from "@/lib/validations/paper";
import { DIFFICULTIES } from "@/lib/defense/config";

/** Model-output + server-action schemas for defense prep. */

export const difficultySchema = z.enum(DIFFICULTIES);

/**
 * One generated question. `explanation`, `answer` and `key_points` have no
 * columns of their own — they are packed into `defense_questions.reference_answer`
 * as JSON (see `lib/defense/practice.ts`), so they are validated together here.
 */
export const llmDefenseQuestionSchema = z.object({
  question: z.string().trim().min(1).max(600),
  explanation: z.string().trim().max(600).default(""),
  answer: z.string().trim().max(2000).default(""),
  key_points: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  source_quote: z.string().trim().max(1000).nullable().default(null),
  difficulty: difficultySchema.default("probing"),
});
export type LlmDefenseQuestion = z.infer<typeof llmDefenseQuestionSchema>;

export const llmDefenseGroupSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).default(""),
  questions: z.array(llmDefenseQuestionSchema).max(12).default([]),
});
export type LlmDefenseGroup = z.infer<typeof llmDefenseGroupSchema>;

export const llmDefensePlanSchema = z.object({
  groups: z.array(llmDefenseGroupSchema).default([]),
});
export type LlmDefensePlan = z.infer<typeof llmDefensePlanSchema>;

// --- Answer feedback (model output) ----------------------------------------

export const FEEDBACK_VERDICTS = ["strong", "adequate", "needs_work"] as const;
export const feedbackVerdictSchema = z.enum(FEEDBACK_VERDICTS);
export type FeedbackVerdict = z.infer<typeof feedbackVerdictSchema>;

export const answerFeedbackSchema = z.object({
  strengths: z.array(z.string().trim().min(1).max(400)).max(6).default([]),
  gaps: z.array(z.string().trim().min(1).max(400)).max(6).default([]),
  suggestion: z.string().trim().max(600).default(""),
  verdict: feedbackVerdictSchema,
});
export type AnswerFeedbackData = z.infer<typeof answerFeedbackSchema>;

// --- Server-action inputs --------------------------------------------------

export const generateDefenseSchema = z.object({ analysisId: uuidSchema });
export type GenerateDefenseInput = z.infer<typeof generateDefenseSchema>;

export const createPracticeSchema = z.object({ analysisId: uuidSchema });
export type CreatePracticeInput = z.infer<typeof createPracticeSchema>;

export const submitAnswerSchema = z.object({
  practiceId: uuidSchema,
  questionId: uuidSchema,
  answer: z.string().trim().min(1, "must not be empty").max(5000),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

export const skipAnswerSchema = z.object({
  practiceId: uuidSchema,
  questionId: uuidSchema,
});
export type SkipAnswerInput = z.infer<typeof skipAnswerSchema>;

export const finishPracticeSchema = z.object({ practiceId: uuidSchema });
export type FinishPracticeInput = z.infer<typeof finishPracticeSchema>;
