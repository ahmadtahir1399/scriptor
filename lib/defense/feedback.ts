import "server-only";

import { completeStructured } from "@/lib/ai/complete";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import { DEFENSE_LIMITS } from "@/lib/defense/config";
import {
  answerFeedbackSchema,
  type AnswerFeedbackData,
} from "@/lib/validations/defense";

/**
 * Feedback on a student's practice answer.
 *
 * Receives the QUESTION, the student's ANSWER, and the stored KEY POINTS — never
 * the whole thesis. The question already encodes the relevant context, so
 * re-sending the document per answer would be wasteful and leak context the
 * feedback doesn't need. The tone is a supportive examiner: what was strong,
 * what was missing, one concrete thing to do next.
 */

const SYSTEM = `You are a supportive but rigorous examiner giving feedback on a student's practice answer to a viva question.

You are given the QUESTION, the KEY POINTS a strong answer should hit, and the student's ANSWER. Assess the answer ONLY against these — you do not have the thesis in front of you and must not ask for it.

Return:
- "strengths": what the answer did well (specific, not flattery). May be empty for a weak answer.
- "gaps": key points the answer missed or handled weakly.
- "suggestion": one concrete thing to do to strengthen the answer.
- "verdict": "strong" (would satisfy a committee), "adequate" (passable, with gaps), or "needs_work" (would not yet satisfy).

Be calm and constructive. Return JSON: { "strengths": [], "gaps": [], "suggestion": "", "verdict": "" }. Return JSON only.`;

export async function generateAnswerFeedback(args: {
  question: string;
  keyPoints: readonly string[];
  answer: string;
  attribution: UsageAttribution;
}): Promise<AnswerFeedbackData> {
  const keyPoints =
    args.keyPoints.length > 0
      ? args.keyPoints.map((point) => `- ${point}`).join("\n")
      : "(none provided)";

  const result = await completeStructured({
    role: "REASONING",
    system: SYSTEM,
    // Only the question, its key points and the student's answer — never the thesis.
    user: `QUESTION:\n${args.question}\n\nKEY POINTS:\n${keyPoints}\n\nSTUDENT ANSWER:\n${args.answer}`,
    schema: answerFeedbackSchema,
    schemaName: "answerFeedback",
    attribution: args.attribution,
    temperature: 0.3,
    maxOutputTokens: DEFENSE_LIMITS.maxFeedbackTokens,
  });

  return result.data;
}
