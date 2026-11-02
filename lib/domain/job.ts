import type { Tables } from "@/lib/db/types.generated";
import type { JobKind, JobStatus } from "@/lib/db/enums";

/** Job queue aggregate — P4 is built on this. */

export type AnalysisJob = Tables<"analysis_jobs">;
export type TokenUsage = Tables<"token_usage">;

/**
 * Priority bands.
 *
 * Compatibility and parsing gate every other job, so they must outrank the
 * checks that depend on them — otherwise a busy queue starves the very work
 * that unblocks it.
 */
export const JOB_PRIORITY = {
  gate: 100, // COMPATIBILITY, PARSE — nothing else can start without these
  structure: 75, // IDENTIFY_PAGES — checks are scoped by page type
  check: 50, // RUN_CHECK, GRAMMAR — the main body of work
  optional: 25, // TODO_LIST, DEFENSE_QUESTIONS, AI_DETECTION
  cleanup: 0, // POST_PROCESSING
} as const;

/** Job kinds whose failure must not fail the parent analysis. */
export const OPTIONAL_JOB_KINDS: readonly JobKind[] = [
  "TODO_LIST",
  "DEFENSE_QUESTIONS",
  "AI_DETECTION",
  "REFERENCE_HEALTH",
];

export function isOptionalKind(kind: JobKind): boolean {
  return OPTIONAL_JOB_KINDS.includes(kind);
}

export function priorityForKind(kind: JobKind): number {
  switch (kind) {
    case "COMPATIBILITY":
    case "PARSE":
      return JOB_PRIORITY.gate;
    case "IDENTIFY_PAGES":
      return JOB_PRIORITY.structure;
    case "RUN_CHECK":
    case "GRAMMAR":
    case "BIBLIOGRAPHY":
    case "EXTRACT_REQUIREMENTS":
      return JOB_PRIORITY.check;
    case "REFERENCE_HEALTH":
    case "AI_DETECTION":
    case "TODO_LIST":
    case "DEFENSE_QUESTIONS":
      return JOB_PRIORITY.optional;
    case "POST_PROCESSING":
      return JOB_PRIORITY.cleanup;
  }
}

/**
 * Builds the unique idempotency key for a job.
 *
 * Must be deterministic from the logical identity of the work — same analysis,
 * same kind, same discriminator produces the same key, so a re-enqueue after a
 * partial failure is a no-op rather than a duplicate. `discriminator` separates
 * per-check and per-page jobs of the same kind.
 */
export function buildIdempotencyKey(
  analysisId: string,
  kind: JobKind,
  discriminator?: string,
): string {
  return discriminator
    ? `${analysisId}:${kind}:${discriminator}`
    : `${analysisId}:${kind}`;
}

/** True when a job will never change state again without intervention. */
export function isJobTerminal(job: AnalysisJob): boolean {
  if (job.status === "DONE") return true;
  return job.status === "ERROR" && job.attempts >= job.max_attempts;
}

/** True when a failed job still has retries left and is waiting on backoff. */
export function isJobRetrying(job: AnalysisJob): boolean {
  return (
    job.status === "NONE" &&
    job.attempts > 0 &&
    job.attempts < job.max_attempts &&
    new Date(job.run_after).getTime() > Date.now()
  );
}

export interface QueueSnapshot {
  pending: number;
  running: number;
  done: number;
  failed: number;
}

export function snapshotQueue(jobs: readonly AnalysisJob[]): QueueSnapshot {
  const countBy = (status: JobStatus): number =>
    jobs.filter((job) => job.status === status).length;

  return {
    pending: countBy("NONE"),
    running: countBy("GENERATING"),
    done: countBy("DONE"),
    failed: countBy("ERROR"),
  };
}

/** Aggregate cost, for the P16 analytics surface. */
export interface CostSummary {
  totalUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  calls: number;
  /** Share of input tokens served from cache. The number to watch. */
  cacheHitRate: number;
}

export function summariseCost(rows: readonly TokenUsage[]): CostSummary {
  let totalUsd = 0;
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let calls = 0;

  for (const row of rows) {
    totalUsd += row.cost_usd;
    inputTokens += row.input_tokens;
    cachedInputTokens += row.cached_input_tokens;
    outputTokens += row.output_tokens;
    calls += row.calls;
  }

  const totalInput = inputTokens + cachedInputTokens;

  return {
    totalUsd: Number(totalUsd.toFixed(6)),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    calls,
    cacheHitRate: totalInput === 0 ? 0 : cachedInputTokens / totalInput,
  };
}
