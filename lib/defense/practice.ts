import type { FindingSeverity } from "@/lib/db/enums";
import type { Difficulty } from "@/lib/defense/config";
import { VERDICT_SCORE } from "@/lib/defense/config";
import {
  answerFeedbackSchema,
  type AnswerFeedbackData,
  type FeedbackVerdict,
} from "@/lib/validations/defense";

/**
 * Defense encoding helpers and practice maths.
 *
 * PURE. No I/O. `defense_questions` has columns for the question, the reference
 * answer and the source quote, but NOT for the "why they ask" explanation or the
 * key points a good answer must hit — so those are packed as JSON into
 * `reference_answer` and unpacked here. Structured answer feedback is likewise
 * JSON in `defense_question_answers.feedback`. The student never sees the raw
 * encoded columns; the UI always renders the decoded parts.
 */

// ---------------------------------------------------------------------------
// Reference answer (explanation + model answer + key points)
// ---------------------------------------------------------------------------

export interface ReferenceAnswer {
  explanation: string;
  answer: string;
  keyPoints: string[];
}

export function encodeReferenceAnswer(value: ReferenceAnswer): string {
  return JSON.stringify(value);
}

/** Decodes the packed reference answer, tolerant of legacy plain text. */
export function parseReferenceAnswer(raw: string): ReferenceAnswer {
  try {
    const parsed = JSON.parse(raw) as Partial<ReferenceAnswer>;
    if (typeof parsed === "object" && parsed !== null && "answer" in parsed) {
      return {
        explanation:
          typeof parsed.explanation === "string" ? parsed.explanation : "",
        answer: typeof parsed.answer === "string" ? parsed.answer : "",
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.filter(
              (point): point is string => typeof point === "string",
            )
          : [],
      };
    }
  } catch {
    // fall through to plain-text treatment
  }
  return { explanation: "", answer: raw, keyPoints: [] };
}

// ---------------------------------------------------------------------------
// Answer feedback
// ---------------------------------------------------------------------------

export function encodeFeedback(feedback: AnswerFeedbackData): string {
  return JSON.stringify(feedback);
}

/** Decodes stored feedback, returning null when absent or unparseable (skipped). */
export function parseFeedback(raw: string | null): AnswerFeedbackData | null {
  if (!raw) return null;
  try {
    const parsed = answerFeedbackSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function verdictToScore(verdict: FeedbackVerdict): number {
  return VERDICT_SCORE[verdict];
}

// ---------------------------------------------------------------------------
// Difficulty ↔ finding_severity (the enum the column reuses)
// ---------------------------------------------------------------------------

export function difficultyToSeverity(difficulty: Difficulty): FindingSeverity {
  switch (difficulty) {
    case "foundational":
      return "LOW";
    case "probing":
      return "MEDIUM";
    case "challenging":
      return "HIGH";
  }
}

export function severityToDifficulty(severity: FindingSeverity): Difficulty {
  switch (severity) {
    case "LOW":
      return "foundational";
    case "MEDIUM":
      return "probing";
    case "HIGH":
      return "challenging";
  }
}
