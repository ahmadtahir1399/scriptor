// SERVER ONLY — writes to token_usage, which is service-role only.
import "server-only";

import type { z } from "zod";

import type { LlmOperation } from "@/lib/db/enums";
import {
  calculateCostUsd,
  type ModelRole,
  type TokenCounts,
} from "@/lib/ai/models";
import { recordTokenUsage } from "@/lib/db/queries/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cost ledger writes.
 *
 * Called by `complete()` after every model call, without exception. There is
 * deliberately no way to make a model call that skips this — see the note in
 * `lib/ai/client.ts`.
 */

export interface UsageAttribution {
  paperUploadId: string | null;
  paperAnalysisId: string | null;
  analysisJobId: string | null;
  userId: string | null;
  operation: LlmOperation;
}

export interface RawUsage {
  /** Total prompt tokens as reported by the provider, INCLUDING cached. */
  promptTokens: number;
  /** Subset of promptTokens served from cache. */
  cachedPromptTokens: number;
  completionTokens: number;
}

/**
 * Records one model call.
 *
 * Never throws. A failure to write the ledger must not fail the analysis the
 * student is waiting on — losing a cost row is an accounting gap, losing the
 * analysis is a product failure. The error is logged loudly instead so the
 * gap is visible.
 */
export async function logTokenUsage(
  attribution: UsageAttribution,
  role: ModelRole,
  modelId: string,
  usage: RawUsage,
  latencyMs: number,
): Promise<void> {
  const tokens: TokenCounts = {
    inputTokens: usage.promptTokens,
    cachedInputTokens: usage.cachedPromptTokens,
    outputTokens: usage.completionTokens,
  };

  try {
    const db = createAdminClient();
    await recordTokenUsage(db, {
      paperUploadId: attribution.paperUploadId,
      paperAnalysisId: attribution.paperAnalysisId,
      analysisJobId: attribution.analysisJobId,
      userId: attribution.userId,
      operation: attribution.operation,
      model: modelId,
      calls: 1,
      inputTokens: tokens.inputTokens,
      cachedInputTokens: tokens.cachedInputTokens,
      outputTokens: tokens.outputTokens,
      costUsd: calculateCostUsd(role, tokens),
      latencyMs,
    });
  } catch (error) {
    console.error(
      "[tokenUsage] failed to record LLM cost — ledger now has a gap",
      { operation: attribution.operation, model: modelId, error },
    );
  }
}

/** Convenience alias so call sites read naturally. */
export type StructuredSchema<T> = z.ZodType<T>;
