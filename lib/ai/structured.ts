import "server-only";

import type { z } from "zod";

import { completeStructured, complete } from "@/lib/ai/complete";
import { buildCachedLayout } from "@/lib/ai/cache";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import type { ModelRole } from "@/lib/ai/models";

/**
 * The two model calls a check makes, wrapped so a handler cannot get the cache
 * layout wrong.
 *
 * Handlers do not touch `complete()` directly for check work — they call
 * `analyseWithCache()` and `writeFeedback()`. That keeps the byte-stable prefix
 * discipline in one place: the document body always goes through
 * `buildCachedLayout`, so it is always positioned as the cacheable prefix.
 */

export interface AnalyseArgs<T> {
  role: ModelRole | string;
  /** Cacheable — identical across all checks on this upload+scope. */
  documentBody: string;
  /** Variable — this check's analysis_prompt. Placed last. */
  analysisInstruction: string;
  schema: z.ZodType<T>;
  schemaName: string;
  attribution: UsageAttribution;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AnalyseResult<T> {
  data: T;
  cachedInputTokens: number;
  modelId: string;
}

/**
 * Stage A — structured analysis over the cached document body.
 *
 * The layout guarantees the body is the cacheable prefix; the check-specific
 * instruction is the trailing variable. The returned `cachedInputTokens` lets
 * the caller confirm, per call, that caching is actually working — a silent
 * cache miss is invisible anywhere else.
 */
export async function analyseWithCache<T>(
  args: AnalyseArgs<T>,
): Promise<AnalyseResult<T>> {
  const layout = buildCachedLayout(args.documentBody, args.analysisInstruction);

  const result = await completeStructured<T>({
    role: args.role,
    system: layout.prefix[0]?.content ?? "",
    cachedContent: layout.prefix[1]?.content ?? "",
    user: layout.instruction.content,
    schema: args.schema,
    schemaName: args.schemaName,
    attribution: args.attribution,
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
  });

  return {
    data: result.data,
    cachedInputTokens: result.cachedInputTokens,
    modelId: result.modelId,
  };
}

export interface FeedbackArgs {
  role: ModelRole | string;
  feedbackPrompt: string;
  /** The structured findings from stage A, serialised — small, not the body. */
  structuredFindings: string;
  attribution: UsageAttribution;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Stage B — student-facing feedback from the structured findings.
 *
 * Prose is generated FROM structured data, never the other way round. There is
 * no path in this codebase that parses prose back into findings — that would be
 * lossy and unlocatable. The feedback prompt is the check's own
 * `feedback_prompt`; the document body is NOT re-sent here, keeping this stage
 * cheap.
 */
export async function writeFeedback(
  args: FeedbackArgs,
): Promise<{ text: string }> {
  const result = await complete({
    role: args.role,
    system: args.feedbackPrompt,
    user: args.structuredFindings,
    attribution: args.attribution,
    temperature: args.temperature ?? 0.4,
    maxOutputTokens: args.maxOutputTokens,
  });

  return { text: result.text };
}
