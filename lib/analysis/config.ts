import type { PageType } from "@/lib/db/enums";

/**
 * Analysis engine configuration.
 *
 * EVERY tunable in the analysis pipeline lives here. There are no magic numbers
 * inline in a handler — a cost ceiling buried in `runCheck.ts` is a cost
 * ceiling nobody can find when the bill arrives. Anything that could plausibly
 * become a "Quick vs Deep" toggle, a pricing tier, or a rate-limit knob is a
 * named constant in this file.
 */

// ---------------------------------------------------------------------------
// Cost control
// ---------------------------------------------------------------------------

/**
 * Hard ceiling per analysis, USD. When the summed `token_usage.cost_usd` for an
 * analysis crosses this before a check's model call, the remaining RUN_CHECK
 * jobs are cancelled and the analysis is marked ERROR with reason COST_CEILING.
 *
 * Sized so a normal nine-check thesis (~$0.40 with caching working) sits far
 * below it, but a runaway — a caching regression turning $0.40 into $4, or a
 * pathological document — is stopped before it becomes real money.
 */
export const MAX_ANALYSIS_COST_USD = 2.5;

/**
 * Rough cost estimate written to `paper_analyses.estimated_cost_usd` before any
 * work starts, so the UI can show an expectation and the guard has a baseline.
 * Deliberately an overestimate — better to predict $0.60 and spend $0.40 than
 * the reverse.
 */
export const COST_ESTIMATE = {
  /** USD per 1,000 document words, per ALL_PAGES check, first (uncached) pass. */
  perThousandWordsFirstCheck: 0.06,
  /** Per 1,000 words for each subsequent ALL_PAGES check — mostly cache hits. */
  perThousandWordsCachedCheck: 0.012,
  /** Flat feedback-stage cost per check (small structured input). */
  feedbackPerCheck: 0.01,
  /** Per sampled page for an INDIVIDUAL_PAGES check. */
  perIndividualPage: 0.004,
} as const;

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

/**
 * Concurrency caps. Two independent limits:
 *  - perAnalysis protects one student's latency (their nine checks should not
 *    serialise behind another student's).
 *  - perModelRole protects the provider rate limit across all analyses.
 *
 * These are advisory hints the enqueue layer uses to set job priority and the
 * worker batch size; the authoritative serialisation is still
 * `claim_analysis_jobs()`' SKIP LOCKED.
 */
export const CONCURRENCY = {
  perAnalysis: 4,
  perModelRole: {
    FAST: 8,
    REASONING: 4,
    EXTRACTION: 4,
  },
} as const;

// ---------------------------------------------------------------------------
// Page sampling — the cap on INDIVIDUAL_PAGES fan-out
// ---------------------------------------------------------------------------

/**
 * Above `threshold` BODY pages, an INDIVIDUAL_PAGES check samples rather than
 * running every page — evenly spaced so the sample is representative rather
 * than just the first N. This is plausibly what a future Quick/Deep toggle
 * flips.
 */
export const PAGE_SAMPLING = {
  threshold: 40,
  maxSampledPages: 40,
} as const;

// ---------------------------------------------------------------------------
// Model output bounds
// ---------------------------------------------------------------------------

export const OUTPUT_LIMITS = {
  analysisMaxTokens: 4096,
  feedbackMaxTokens: 1500,
  /** Findings beyond this per check are noise; the prompt asks for fewer. */
  maxFindingsPerCheck: 30,
} as const;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Per-check weight in the overall score, keyed by check `code`.
 *
 * Argumentation and coherence carry the most weight because they are what an
 * examiner actually grades; gendering and terminology matter but move the
 * needle less. A check with no entry here uses `defaultWeight`.
 */
export const CHECK_WEIGHTS: Record<string, number> = {
  ARGUMENTATION: 1.5,
  COHERENCE: 1.4,
  LOGICAL_ERRORS: 1.3,
  SOURCE_DENSITY: 1.1,
  CITATION_STYLE: 1.0,
  CHAPTER_ORDER: 0.9,
  TERMINOLOGY: 0.9,
  COVER_PAGE: 0.6,
  GENDERING: 0.6,
};

export const DEFAULT_CHECK_WEIGHT = 1.0;

/**
 * Category rollup. Each check maps to exactly one category; the report groups
 * results under these headings.
 */
export const CHECK_CATEGORIES = [
  "STRUCTURE",
  "REFERENCING",
  "STYLE",
  "ARGUMENTATION",
] as const;

export type CheckCategory = (typeof CHECK_CATEGORIES)[number];

export const CHECK_CATEGORY_MAP: Record<string, CheckCategory> = {
  COVER_PAGE: "STRUCTURE",
  CHAPTER_ORDER: "STRUCTURE",
  CITATION_STYLE: "REFERENCING",
  SOURCE_DENSITY: "REFERENCING",
  GENDERING: "STYLE",
  TERMINOLOGY: "STYLE",
  ARGUMENTATION: "ARGUMENTATION",
  COHERENCE: "ARGUMENTATION",
  LOGICAL_ERRORS: "ARGUMENTATION",
};

export function categoryForCheck(checkCode: string): CheckCategory {
  return CHECK_CATEGORY_MAP[checkCode] ?? "STYLE";
}

export function weightForCheck(checkCode: string): number {
  return CHECK_WEIGHTS[checkCode] ?? DEFAULT_CHECK_WEIGHT;
}

// ---------------------------------------------------------------------------
// Page scope
// ---------------------------------------------------------------------------

/** The page types a check reads if its own `page_scope` is somehow empty. */
export const DEFAULT_PAGE_SCOPE: readonly PageType[] = ["BODY"];

/** Retry budget for a check job before it becomes a permanent error card. */
export const CHECK_MAX_ATTEMPTS = 3;
