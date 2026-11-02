import "server-only";

import { completeStructured } from "@/lib/ai/complete";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import {
  DEFENSE_LIMITS,
  DEFENSE_QUESTION_RANGE,
  DEFENSE_THEMES,
} from "@/lib/defense/config";
import {
  llmDefensePlanSchema,
  type LlmDefenseGroup,
} from "@/lib/validations/defense";

/**
 * Generates examiner-grade viva questions for THIS thesis.
 *
 * Reads the thesis (abstract/methodology/results/conclusion emphasis) and its
 * known weaknesses — the weakest checks become the sharpest questions. Generic
 * questions are not wanted; every question must target something real in this
 * document. Each carries the "why they'd ask", a strong model answer, the key
 * points a good answer must hit, and a difficulty tier.
 */

const SYSTEM = `You are an experienced, fair but rigorous thesis examiner preparing the questions you would actually ask this candidate at their viva.

You are given the student's thesis text and a list of KNOWN WEAKNESSES found in a prior review. Produce a set of likely committee questions.

Rules:
- Generate between ${DEFENSE_QUESTION_RANGE.min} and ${DEFENSE_QUESTION_RANGE.max} questions total.
- Cluster them into themed groups. Group titles from: ${DEFENSE_THEMES.join(", ")}. Omit an empty group; order groups by how central/likely they are.
- Every question must target something SPECIFIC in THIS thesis — a real claim, method choice, sample, gap or limitation. Never a generic question that could apply to any thesis.
- Lean on the known weaknesses: a small sample, an unsupported claim, a thin literature review are exactly what an examiner probes.
- For each question provide:
  - "explanation": one or two sentences on WHY an examiner asks this (tie it to the weakness or claim).
  - "answer": a strong model answer the student can learn from.
  - "key_points": the 2–4 beats a good answer must hit.
  - "source_quote": a short verbatim passage from the thesis the question relates to, or null.
  - "difficulty": "foundational" (should be easy to answer), "probing" (requires real thought), or "challenging" (tests the weakest ground).

Return JSON: { "groups": [ { "title", "description", "questions": [ { "question", "explanation", "answer", "key_points": [], "source_quote", "difficulty" } ] } ] }. Return JSON only.`;

export async function generateDefenseQuestions(args: {
  thesisBody: string;
  findingsSummary: string;
  attribution: UsageAttribution;
}): Promise<LlmDefenseGroup[]> {
  const result = await completeStructured({
    role: "REASONING",
    system: SYSTEM,
    // The thesis body is the cacheable prefix; the weaknesses vary per analysis.
    cachedContent: args.thesisBody,
    user: `KNOWN WEAKNESSES:\n${args.findingsSummary || "None flagged — generate foundational questions covering the core of the thesis."}`,
    schema: llmDefensePlanSchema,
    schemaName: "defensePlan",
    attribution: args.attribution,
    temperature: 0.4,
    maxOutputTokens: DEFENSE_LIMITS.maxGenerationTokens,
  });

  return result.data.groups.slice(0, DEFENSE_LIMITS.maxGroups);
}
