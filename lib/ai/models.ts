/**
 * Model roles.
 *
 * `check_versions.model` stores a ROLE NAME from this file — never a raw model
 * ID. Swapping the underlying model when a better or cheaper one ships is then
 * a one-line edit here, instead of an UPDATE across every catalogue row and
 * every historical result.
 *
 * ---------------------------------------------------------------------------
 * VERIFIED 2026-08-08 against the live OpenAI API (`GET /v1/models`) with this
 * project's key, and against developers.openai.com/api/docs/pricing. Both IDs
 * below are listed and callable. Re-check pricing when changing a model: a
 * wrong ID fails loudly at the first call, but wrong pricing silently corrupts
 * every cost figure in the P16 dashboards.
 *
 * NOTE: the gpt-5.x families reject `max_tokens` outright — `lib/ai/complete.ts`
 * sends `max_completion_tokens`. Reverting either without the other breaks
 * every model call in the app.
 * ---------------------------------------------------------------------------
 */

/**
 * Canonical role names, as referenced by the ingestion and analysis pipelines.
 *
 * FAST       — high-volume, low-judgement work: page classification, batched
 *              extraction. Runs hundreds of times per thesis.
 * REASONING  — long-document analysis where quality dominates cost.
 * EXTRACTION — structured pulls from a document with no judgement involved.
 */
export const MODEL_ROLES = ["FAST", "REASONING", "EXTRACTION"] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export interface ModelSpec {
  /** Provider model ID sent on the wire. */
  id: string;
  /** USD per 1M input tokens. */
  inputPricePerMillion: number;
  /** USD per 1M cached input tokens — the reason caching is worth measuring. */
  cachedInputPricePerMillion: number;
  /** USD per 1M output tokens. */
  outputPricePerMillion: number;
  contextWindow: number;
  supportsCaching: boolean;
}

/**
 * gpt-5.4-mini is the working model for everything the reference and ingestion
 * pipelines do: page classification and single-citation parsing are small,
 * high-volume, judgement-light calls where a frontier model buys nothing.
 * REASONING keeps the larger gpt-5.4 because whole-document analysis is the one
 * place quality dominates cost — point it at gpt-5.4-mini here if you want the
 * cheaper local run; nothing else in the app needs to change.
 */
export const MODELS: Record<ModelRole, ModelSpec> = {
  FAST: {
    id: "gpt-5.4-mini",
    inputPricePerMillion: 0.75,
    cachedInputPricePerMillion: 0.075,
    outputPricePerMillion: 4.5,
    contextWindow: 272_000,
    supportsCaching: true,
  },
  REASONING: {
    id: "gpt-5.4",
    inputPricePerMillion: 2.5,
    cachedInputPricePerMillion: 0.25,
    outputPricePerMillion: 15.0,
    contextWindow: 272_000,
    supportsCaching: true,
  },
  EXTRACTION: {
    id: "gpt-5.4-mini",
    inputPricePerMillion: 0.75,
    cachedInputPricePerMillion: 0.075,
    outputPricePerMillion: 4.5,
    contextWindow: 272_000,
    supportsCaching: true,
  },
};

/**
 * Lowercase aliases.
 *
 * P1's seed wrote `reasoning` and `fast` into `check_versions.model` for all
 * nine checks. Rather than migrate those rows, both spellings resolve — the
 * uppercase names are canonical for new code.
 */
const ROLE_ALIASES: Record<string, ModelRole> = {
  fast: "FAST",
  reasoning: "REASONING",
  extraction: "EXTRACTION",
  cheap: "FAST",
};

export function isModelRole(value: string): value is ModelRole {
  return (MODEL_ROLES as readonly string[]).includes(value);
}

/**
 * Resolves a stored role name to a concrete model.
 *
 * Throws rather than falling back: silently substituting a different model
 * would corrupt the provenance that `check_versions` exists to guarantee.
 */
export function resolveModelRole(role: string): ModelRole {
  if (isModelRole(role)) return role;

  const aliased = ROLE_ALIASES[role.toLowerCase()];
  if (aliased) return aliased;

  throw new Error(
    `Unknown model role "${role}". Valid roles: ${MODEL_ROLES.join(", ")}.`,
  );
}

export function resolveModel(role: string): ModelSpec {
  return MODELS[resolveModelRole(role)];
}

export interface TokenCounts {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/**
 * Computes the USD cost of one call, written straight into `token_usage`.
 *
 * Cached input is billed separately and far cheaper, which is why
 * `cached_input_tokens` is a first-class column: without it there is no way to
 * distinguish a working cache from a broken one, and a broken cache can
 * multiply the cost of an analysis several times over with no other symptom.
 *
 * Note the subtraction — OpenAI reports `prompt_tokens` as the TOTAL including
 * cached tokens, so billing the full figure at the uncached rate would
 * overstate cost precisely when caching is working best.
 */
export function calculateCostUsd(role: ModelRole, tokens: TokenCounts): number {
  const model = MODELS[role];
  const perMillion = 1_000_000;

  const uncachedInput = Math.max(
    0,
    tokens.inputTokens - tokens.cachedInputTokens,
  );

  const inputCost = (uncachedInput / perMillion) * model.inputPricePerMillion;
  const cachedCost =
    (tokens.cachedInputTokens / perMillion) * model.cachedInputPricePerMillion;
  const outputCost =
    (tokens.outputTokens / perMillion) * model.outputPricePerMillion;

  // token_usage.cost_usd is numeric(12,6); round here so the stored value and
  // the value reasoned about in tests are the same number.
  return Number((inputCost + cachedCost + outputCost).toFixed(6));
}
