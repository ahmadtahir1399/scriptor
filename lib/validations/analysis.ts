import { z } from "zod";

import { FINDING_SEVERITIES, FINDING_TYPES, JOB_KINDS } from "@/lib/db/enums";
import { uuidSchema } from "@/lib/validations/paper";

/** Server-action input schemas for the analysis aggregate. */

export const startAnalysisSchema = z.object({
  uploadId: uuidSchema,
  checkIds: z
    .array(uuidSchema)
    .min(1, "select at least one check")
    .max(100, "too many checks selected"),
  includeTodoList: z.boolean().default(false),
  includeDefenseQuestions: z.boolean().default(false),
  includeAiDetection: z.boolean().default(false),
  includeReferenceHealth: z.boolean().default(false),
});
export type StartAnalysisInput = z.infer<typeof startAnalysisSchema>;

/** The two user-writable columns on check_results, and nothing else. */
export const rateCheckResultSchema = z.object({
  checkResultId: uuidSchema,
  rating: z.number().int().min(1).max(5).nullable(),
  isHelpful: z.boolean().nullable(),
  userComment: z.string().trim().max(2000).nullable(),
});
export type RateCheckResultInput = z.infer<typeof rateCheckResultSchema>;

export const resolveFindingSchema = z.object({
  findingId: uuidSchema,
  isResolved: z.boolean(),
});
export type ResolveFindingInput = z.infer<typeof resolveFindingSchema>;

/**
 * Shape the LLM must return for a finding.
 *
 * `quote` carries a minimum length and a non-whitespace refinement because an
 * empty or blank quote cannot be anchored to a location in the document. The
 * database enforces the same rule via `findings_quote_not_empty`; validating
 * here means an unusable finding is dropped at ingestion with a clear reason
 * rather than surfacing as a constraint violation.
 */
export const llmFindingSchema = z.object({
  quote: z
    .string()
    .min(1, "must not be empty")
    .refine((value) => value.trim().length > 0, "must not be only whitespace"),
  correction: z.string().nullable().default(null),
  title: z.string().trim().min(1, "must not be empty").max(200),
  description: z.string().trim().default(""),
  page_number: z.number().int().positive().nullable().default(null),
  severity: z.enum(FINDING_SEVERITIES).default("MEDIUM"),
});
export type LlmFinding = z.infer<typeof llmFindingSchema>;

export const llmFindingsResponseSchema = z.object({
  findings: z.array(llmFindingSchema).default([]),
});
export type LlmFindingsResponse = z.infer<typeof llmFindingsResponseSchema>;

/** A finding as persisted, once the worker has resolved its location. */
export const persistFindingSchema = llmFindingSchema.extend({
  checkResultId: uuidSchema,
  paperAnalysisId: uuidSchema,
  type: z.enum(FINDING_TYPES),
  charStart: z.number().int().nonnegative().nullable().default(null),
  charEnd: z.number().int().nonnegative().nullable().default(null),
  wordIndexStart: z.number().int().nonnegative().nullable().default(null),
  wordIndexEnd: z.number().int().nonnegative().nullable().default(null),
});
export type PersistFindingInput = z.infer<typeof persistFindingSchema>;

/** Enqueue input for the orchestrator. */
export const enqueueJobSchema = z.object({
  paperAnalysisId: uuidSchema,
  paperUploadId: uuidSchema,
  kind: z.enum(JOB_KINDS),
  payload: z.record(z.string(), z.unknown()).default({}),
  priority: z.number().int().min(0).max(100).optional(),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  isOptional: z.boolean().default(false),
  /** Distinguishes per-check or per-page jobs of the same kind. */
  discriminator: z.string().trim().max(200).optional(),
});
export type EnqueueJobInput = z.infer<typeof enqueueJobSchema>;

export const claimJobsSchema = z.object({
  workerId: z.string().trim().min(1).max(200),
  batchSize: z.number().int().min(1).max(50).default(1),
});
export type ClaimJobsInput = z.infer<typeof claimJobsSchema>;

// ===========================================================================
// P4 — structured check-engine output.
//
// These validate what a MODEL returns, at the boundary before it touches the
// database. A response that fails the schema is a job failure, not a silent
// partial write — the whole point of validating here is that a malformed field
// never becomes a constraint violation three tables downstream.
// ===========================================================================

/**
 * A finding from a RATED check (citation, argumentation, coherence, …).
 *
 * `quote` is required and non-empty: a finding the model cannot quote cannot be
 * located in the document, and an unlocatable finding is dropped, never shown.
 *
 * ---------------------------------------------------------------------------
 * FIELD NAMES HERE MUST MATCH THE SEEDED PROMPTS.
 * ---------------------------------------------------------------------------
 * This schema previously required `reason` and `suggestion`. Every seeded
 * `analysis_prompt` asks the model for `title` / `description` / `correction` —
 * the same vocabulary as the `findings` table and `llmFindingSchema` above — so
 * the model complied with the prompt and this rejected every finding it
 * produced with "reason: expected string, received undefined". The check then
 * errored, and because a check that finds NOTHING never trips the mismatch, the
 * only checks that appeared to work were the ones with nothing to report. The
 * net effect was an analysis that could never surface a single finding.
 *
 * The old names are still accepted as aliases and normalised away below, so a
 * prompt revision that reaches for either vocabulary cannot break a check again.
 */
export const ratedFindingSchema = z
  .object({
    quote: z
      .string()
      .min(1, "must not be empty")
      .refine(
        (value) => value.trim().length > 0,
        "must not be only whitespace",
      ),
    title: z.string().trim().max(200).nullish(),
    description: z.string().trim().max(4000).nullish(),
    correction: z.string().trim().max(2000).nullish(),
    page_number: z.number().int().positive().nullish(),
    // `.catch` rather than `.default`: a model that invents a severity outside
    // the enum should be normalised, not fail the whole batch of findings.
    severity: z.enum(FINDING_SEVERITIES).catch("MEDIUM"),
    /** Legacy aliases. Accepted, never persisted under these names. */
    reason: z.string().trim().max(4000).nullish(),
    suggestion: z.string().trim().max(2000).nullish(),
  })
  .transform((finding) => ({
    quote: finding.quote,
    title: finding.title?.trim() || null,
    // Falls back through the alias, then to the title, so a finding always has
    // something to say for itself in the UI.
    description: (
      finding.description ??
      finding.reason ??
      finding.title ??
      ""
    ).trim(),
    correction: finding.correction ?? finding.suggestion ?? null,
    page_number: finding.page_number ?? null,
    severity: finding.severity,
  }));
export type RatedFinding = z.infer<typeof ratedFindingSchema>;

export const ratedAnalysisResponseSchema = z.object({
  findings: z.array(ratedFindingSchema).default([]),
});
export type RatedAnalysisResponse = z.infer<typeof ratedAnalysisResponseSchema>;

/**
 * A finding from a GRAMMAR-type per-page check.
 *
 * Carries a `correction` (grammar findings always have a concrete fix) and a
 * `type` from the grammar-scoped `finding_type` enum, so it maps directly onto
 * a `findings` table row once its quote is resolved to a word range.
 */
export const grammarFindingSchema = z.object({
  quote: z
    .string()
    .min(1, "must not be empty")
    .refine((value) => value.trim().length > 0, "must not be only whitespace"),
  correction: z.string().trim().max(2000).nullable().default(null),
  /*
   * The per-page prompts return `title` and `description` just like the rated
   * ones. Omitting them here did not fail validation — zod simply dropped them —
   * so the handler fell back to synthesising a description from the correction
   * and the model's actual explanation of the error was thrown away.
   */
  title: z.string().trim().max(200).nullish(),
  description: z.string().trim().max(4000).nullish(),
  // Not in the prompts' output contract; defaulted rather than demanded.
  type: z.enum(FINDING_TYPES).default("GRAMMAR"),
  severity: z.enum(FINDING_SEVERITIES).catch("MEDIUM"),
});
export type GrammarFinding = z.infer<typeof grammarFindingSchema>;

export const grammarResponseSchema = z.object({
  findings: z.array(grammarFindingSchema).default([]),
});
export type GrammarResponse = z.infer<typeof grammarResponseSchema>;

/**
 * The feedback stage's output.
 *
 * `score` is the model's 0–100 quality judgement. It lands in
 * `check_results.score` — NOT `rating`, which is the student's own 1–5 stars.
 * Confusing the two would let a good analysis look like a one-star review.
 */
export const feedbackResponseSchema = z.object({
  feedback: z.string().trim().min(1).max(20000),
  score: z.number().min(0).max(100),
});
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

/** Severity → rank, so dedupe can keep the most serious overlapping finding. */
export const SEVERITY_RANK: Record<
  z.infer<typeof ratedFindingSchema>["severity"],
  number
> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};
