import type { JobKind } from "@/lib/db/enums";
import type { AnalysisJob, TokenUsage } from "@/lib/domain/job";
import {
  buildIdempotencyKey,
  isOptionalKind,
  priorityForKind,
} from "@/lib/domain/job";
import type { Db } from "@/lib/db/queries/papers";

/**
 * Job queue access — P4.
 *
 * SERVER-ONLY. `analysis_jobs` and `token_usage` have RLS enabled and no user
 * policies, and the queue RPCs are revoked from `authenticated`, so every
 * function here requires the service-role client from `lib/supabase/admin.ts`.
 * Calling any of these from a browser client will fail, by design.
 */

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export interface EnqueueJobArgs {
  paperAnalysisId: string;
  paperUploadId: string;
  kind: JobKind;
  payload?: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  /** Separates per-check or per-page jobs of the same kind. */
  discriminator?: string;
}

/**
 * Enqueues a job, or does nothing if the same logical job already exists.
 *
 * The upsert on `idempotency_key` is what makes the orchestrator safe to retry
 * wholesale: re-running enqueue after a partial failure re-creates only the
 * jobs that are genuinely missing, and never duplicates one already queued or
 * completed.
 */
export async function enqueueJob(
  db: Db,
  args: EnqueueJobArgs,
): Promise<AnalysisJob | null> {
  const idempotencyKey = buildIdempotencyKey(
    args.paperAnalysisId,
    args.kind,
    args.discriminator,
  );

  const result = await db
    .from("analysis_jobs")
    .upsert(
      {
        paper_analysis_id: args.paperAnalysisId,
        paper_upload_id: args.paperUploadId,
        kind: args.kind,
        payload: (args.payload ?? {}) as never,
        priority: args.priority ?? priorityForKind(args.kind),
        max_attempts: args.maxAttempts ?? 3,
        is_optional: isOptionalKind(args.kind),
        idempotency_key: idempotencyKey,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();

  return unwrap(result, "enqueueJob");
}

/**
 * Claims a batch of jobs.
 *
 * Delegates to `claim_analysis_jobs()`, which uses FOR UPDATE SKIP LOCKED.
 * Never replace this with a SELECT-then-UPDATE from application code: the gap
 * between the two statements is exactly where two workers claim the same job.
 */
export async function claimJobs(
  db: Db,
  workerId: string,
  batchSize = 1,
): Promise<AnalysisJob[]> {
  const result = await db.rpc("claim_analysis_jobs", {
    p_worker_id: workerId,
    p_batch_size: batchSize,
  });

  return unwrap(result, "claimJobs");
}

export async function completeJob(db: Db, jobId: string): Promise<void> {
  const result = await db.rpc("complete_job", { p_job_id: jobId });
  if (result.error) {
    throw new Error(`completeJob: ${result.error.message}`);
  }
}

/** Fails a job. Re-queues with backoff, or marks ERROR once attempts run out. */
export async function failJob(
  db: Db,
  jobId: string,
  error: string,
): Promise<void> {
  const result = await db.rpc("fail_job", { p_job_id: jobId, p_error: error });
  if (result.error) {
    throw new Error(`failJob: ${result.error.message}`);
  }
}

export async function reapStaleJobs(db: Db): Promise<number> {
  const result = await db.rpc("reap_stale_jobs", {});
  return unwrap(result, "reapStaleJobs");
}

export async function recomputeAnalysisStatus(
  db: Db,
  analysisId: string,
): Promise<void> {
  const result = await db.rpc("recompute_analysis_status", {
    p_analysis_id: analysisId,
  });
  if (result.error) {
    throw new Error(`recomputeAnalysisStatus: ${result.error.message}`);
  }
}

export async function listJobsForAnalysis(
  db: Db,
  analysisId: string,
): Promise<AnalysisJob[]> {
  const result = await db
    .from("analysis_jobs")
    .select("*")
    .eq("paper_analysis_id", analysisId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  return unwrap(result, "listJobsForAnalysis");
}

/** Queue monitor for the P17 admin screen. */
export async function listStuckJobs(
  db: Db,
  olderThanMinutes = 15,
): Promise<AnalysisJob[]> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();

  const result = await db
    .from("analysis_jobs")
    .select("*")
    .eq("status", "GENERATING")
    .lt("claimed_at", cutoff)
    .order("claimed_at", { ascending: true });

  return unwrap(result, "listStuckJobs");
}

// ---------------------------------------------------------------------------
// Token usage — the cost ledger.
// ---------------------------------------------------------------------------

export interface RecordTokenUsageArgs {
  paperUploadId: string | null;
  paperAnalysisId: string | null;
  analysisJobId: string | null;
  userId: string | null;
  operation: TokenUsage["operation"];
  model: string;
  calls?: number;
  inputTokens: number;
  /** Always supply this, even when zero — a missing value and a real zero are
   *  indistinguishable later, and this column is how caching is proven to work. */
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs?: number;
}

export async function recordTokenUsage(
  db: Db,
  args: RecordTokenUsageArgs,
): Promise<void> {
  const result = await db.from("token_usage").insert({
    paper_upload_id: args.paperUploadId,
    paper_analysis_id: args.paperAnalysisId,
    analysis_job_id: args.analysisJobId,
    user_id: args.userId,
    operation: args.operation,
    model: args.model,
    calls: args.calls ?? 1,
    input_tokens: args.inputTokens,
    cached_input_tokens: args.cachedInputTokens,
    output_tokens: args.outputTokens,
    cost_usd: args.costUsd,
    latency_ms: args.latencyMs ?? null,
  });

  if (result.error) {
    throw new Error(`recordTokenUsage: ${result.error.message}`);
  }
}

export async function listTokenUsageForAnalysis(
  db: Db,
  analysisId: string,
): Promise<TokenUsage[]> {
  const result = await db
    .from("token_usage")
    .select("*")
    .eq("paper_analysis_id", analysisId)
    .order("created_at", { ascending: true });

  return unwrap(result, "listTokenUsageForAnalysis");
}

export async function listTokenUsageSince(
  db: Db,
  since: Date,
): Promise<TokenUsage[]> {
  const result = await db
    .from("token_usage")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  return unwrap(result, "listTokenUsageSince");
}
