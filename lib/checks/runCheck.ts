import "server-only";

import type { CheckVersion } from "@/lib/domain/check";
import type { PaperPage } from "@/lib/domain/paper";
import type { Requirement } from "@/lib/domain/requirement";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import { completeStructured } from "@/lib/ai/complete";
import { analyseWithCache, writeFeedback } from "@/lib/ai/structured";
import { buildScopedBody } from "@/lib/checks/pageScope";
import { OUTPUT_LIMITS } from "@/lib/analysis/config";
import {
  REQUIREMENT_CHECK_SYSTEM,
  buildRequirementInstruction,
} from "@/lib/requirements/asCheck";
import {
  requirementVerdictSchema,
  type RequirementVerdict,
} from "@/lib/validations/requirement";
import {
  feedbackResponseSchema,
  ratedAnalysisResponseSchema,
  type RatedFinding,
} from "@/lib/validations/analysis";

/**
 * Runs one ALL_PAGES check: two model calls, structured then human.
 *
 * The whole cost story lives in step 3. The document body is passed as the
 * cacheable content, byte-identical to every other check on this upload, so
 * after the first check the body is a cache hit. The check's own
 * `analysis_prompt` is the trailing variable that never busts the shared
 * prefix.
 *
 * Prose is generated FROM the structured findings, never the reverse. There is
 * no path that parses feedback back into data.
 */

export interface RunCheckOutcome {
  feedback: string;
  score: number;
  findings: RatedFinding[];
  cachedInputTokens: number;
}

export async function runCheck(args: {
  version: CheckVersion;
  role: string;
  pages: readonly PaperPage[];
  attribution: UsageAttribution;
}): Promise<RunCheckOutcome> {
  // Same builder every check uses, so the body string is byte-stable and the
  // cache hits across checks.
  const body = buildScopedBody(args.pages);

  // Stage A — structured analysis over the cached body.
  const analysis = await analyseWithCache({
    role: args.role,
    documentBody: body,
    analysisInstruction: args.version.analysis_prompt,
    schema: ratedAnalysisResponseSchema,
    schemaName: "ratedAnalysis",
    attribution: args.attribution,
    temperature: args.version.temperature,
    maxOutputTokens: OUTPUT_LIMITS.analysisMaxTokens,
  });

  const findings = analysis.data.findings.slice(
    0,
    OUTPUT_LIMITS.maxFindingsPerCheck,
  );

  // Stage B — student-facing feedback from the structured findings. The body is
  // NOT re-sent; only the small structured summary goes up, keeping this cheap.
  const feedbackInput = JSON.stringify({ findings }, null, 2);

  const feedbackResult = await writeFeedback({
    role: args.role,
    // The feedback prompt asks for BOTH the markdown and a 0–100 score, so we
    // append a strict output contract to the check's own feedback_prompt.
    feedbackPrompt: `${args.version.feedback_prompt}

Return a JSON object with exactly two fields:
  "feedback": the student-facing explanation in Markdown,
  "score": an integer 0–100 rating the quality of this aspect of the thesis (100 = flawless).
Return JSON only.`,
    structuredFindings: feedbackInput,
    attribution: args.attribution,
    maxOutputTokens: OUTPUT_LIMITS.feedbackMaxTokens,
  });

  const parsed = parseFeedback(feedbackResult.text, findings.length);

  return {
    feedback: parsed.feedback,
    score: parsed.score,
    findings,
    cachedInputTokens: analysis.cachedInputTokens,
  };
}

/**
 * Parses the feedback stage output.
 *
 * The feedback model returns JSON, but the feedback stage is prose-heavy and a
 * model occasionally wraps it in prose or a code fence. We recover gracefully:
 * if the JSON parses, use it; if it does not, treat the whole text as the
 * feedback and derive a neutral score from the finding count rather than
 * failing the check over a formatting slip.
 */
function parseFeedback(
  raw: string,
  findingCount: number,
): { feedback: string; score: number } {
  const jsonText = extractJson(raw);

  if (jsonText) {
    const validated = feedbackResponseSchema.safeParse(safeJsonParse(jsonText));
    if (validated.success) {
      return {
        feedback: validated.data.feedback,
        score: Math.round(validated.data.score),
      };
    }
  }

  // Fallback: prose without a parseable score. Score inversely with findings,
  // clamped, so the analysis still completes with a sensible number.
  const fallbackScore = Math.max(40, 95 - findingCount * 5);
  return { feedback: raw.trim(), score: fallbackScore };
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  if (trimmed.startsWith("{")) return trimmed;
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return trimmed.slice(braceStart, braceEnd + 1);
  }
  return null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Runs ONE custom requirement as a dynamic check — the P9 extension.
 *
 * Same engine, not a second one: the thesis body is the cacheable prefix (so
 * requirements sharing a page scope hit the cache exactly like standard
 * checks), the requirement text is the trailing variable instruction, and the
 * call flows through the same structured-completion path that logs token_usage.
 * It returns a satisfied/not verdict with evidence, which the handler writes to
 * `upload_requirements` — requirements do not write `check_results`.
 *
 * SECURITY: only the thesis pages reach this prompt. The guidelines document is
 * never here.
 */
export async function runRequirementCheck(args: {
  requirement: Requirement;
  role: string;
  pages: readonly PaperPage[];
  attribution: UsageAttribution;
}): Promise<RequirementVerdict> {
  const body = buildScopedBody(args.pages);

  const result = await completeStructured({
    role: args.role,
    system: REQUIREMENT_CHECK_SYSTEM,
    // Positioned as the cacheable prefix, after the fixed system message.
    cachedContent: body,
    user: buildRequirementInstruction(args.requirement),
    schema: requirementVerdictSchema,
    schemaName: "requirementVerdict",
    attribution: args.attribution,
    temperature: 0,
    maxOutputTokens: 700,
  });

  return result.data;
}
