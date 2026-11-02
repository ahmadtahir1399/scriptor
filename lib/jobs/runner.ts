import "server-only";

import { randomUUID } from "node:crypto";

import { claimJobs, completeJob, failJob } from "@/lib/db/queries/jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHandler, type JobContext } from "@/lib/jobs/registry";
import { isCheckKind, maybeEnqueuePostProcessing } from "@/lib/analysis/status";
import {
  createNotifyMemo,
  notifyForSettledJob,
  type NotifyMemo,
} from "@/lib/notifications/pipeline";
import type { AnalysisJob } from "@/lib/domain/job";

/**
 * The worker loop.
 *
 * Claims a batch through `claim_analysis_jobs()` from P1, which uses
 * FOR UPDATE SKIP LOCKED — two workers running concurrently can never claim
 * the same job, so this is safe to invoke from cron and from `kick()` at the
 * same time.
 *
 * NEVER THROWS. A handler error is caught and routed to `fail_job()`, which
 * applies P1's exponential backoff. An uncaught throw here would leave the job
 * stuck in GENERATING until `reap_stale_jobs()` noticed 15 minutes later.
 */

export const DEFAULT_BATCH_SIZE = 5;

/**
 * How long a single invocation keeps draining before it returns.
 *
 * Under the route's `maxDuration = 300`, with enough headroom that the last
 * handler to start can still finish and write its result. Whatever is left in
 * the queue is picked up by the next cron tick or kick.
 */
const DRAIN_BUDGET_MS = 240_000;

/** Belt and braces: a bug that re-queues work instantly cannot spin forever. */
const MAX_PASSES = 50;

export interface RunResult {
  claimed: number;
  succeeded: number;
  failed: number;
  /** How many claim/process rounds ran. Useful when a drain hits its budget. */
  passes: number;
}

/**
 * Drains the queue rather than processing a single batch.
 *
 * The pipeline is a chain: PARSE enqueues IDENTIFY_PAGES, which enqueues
 * COMPATIBILITY, and the check fan-out enqueues POST_PROCESSING behind a
 * barrier. Returning after one batch meant every link waited for the next cron
 * tick — a minute per stage in production, and *forever* in local development,
 * where no cron exists at all. Claiming again until the queue is empty makes a
 * chained job start the moment its predecessor commits.
 *
 * Safe to run concurrently with another worker: `claim_analysis_jobs()` uses
 * FOR UPDATE SKIP LOCKED, so two drains partition the queue instead of
 * fighting over it. A failing job gets backoff via `fail_job()`, so its
 * `run_after` moves into the future and it stops being claimable — that, not
 * the pass cap, is what normally ends the loop.
 */
export async function runJobs(
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<RunResult> {
  const db = createAdminClient();
  const workerId = `worker-${randomUUID().slice(0, 8)}`;
  const ctx: JobContext = { db, workerId };
  const deadline = Date.now() + DRAIN_BUDGET_MS;
  const notifyMemo = createNotifyMemo();

  let claimed = 0;
  let succeeded = 0;
  let failed = 0;
  let passes = 0;

  while (passes < MAX_PASSES && Date.now() < deadline) {
    let jobs;
    try {
      jobs = await claimJobs(db, workerId, batchSize);
    } catch (error) {
      console.error("[worker] claim failed", error);
      break;
    }

    // Queue drained. Anything enqueued after this point wakes its own worker.
    if (jobs.length === 0) break;

    passes += 1;
    claimed += jobs.length;

    for (const job of jobs) {
      const handler = getHandler(job.kind);

      if (!handler) {
        // Not a crash — a routing gap. Recorded on the job so it is visible in
        // the admin queue view rather than silently retried forever.
        await safeFail(
          db,
          job.id,
          `No handler registered for job kind "${job.kind}".`,
        );
        failed += 1;
        continue;
      }

      try {
        await handler(job, ctx);
        await completeJob(db, job.id);
        succeeded += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[worker] job ${job.id} (${job.kind}) failed`, error);
        await safeFail(db, job.id, message);
        failed += 1;
      }

      // Only now, with this job's terminal status committed, can the barrier
      // see the queue truthfully. See maybeEnqueuePostProcessing for why doing
      // this inside the handler silently stalled every analysis.
      await advanceBarrier(db, job);

      // And only after the barrier, because POST_PROCESSING may have just been
      // enqueued — which is what keeps the analysis GENERATING and stops a
      // "your review is ready" going out one stage early. Same failure
      // isolation as the barrier: notifications are the last word on work that
      // is already done and safe, never a reason to fail the job that did it.
      await notifySettled(db, job, notifyMemo);
    }
  }

  return { claimed, succeeded, failed, passes };
}

/**
 * Advances the POST_PROCESSING barrier after a check job settles.
 *
 * Isolated like `safeFail`: the barrier is bookkeeping, and a failure to
 * evaluate it must not take down the drain loop that is still working through
 * the rest of the queue. A missed barrier is recovered by the next check to
 * settle, or by the stale-job reaper.
 */
async function advanceBarrier(
  db: ReturnType<typeof createAdminClient>,
  job: AnalysisJob,
): Promise<void> {
  if (!isCheckKind(job.kind)) return;

  try {
    await maybeEnqueuePostProcessing(
      db,
      job.paper_analysis_id,
      job.paper_upload_id,
    );
  } catch (error) {
    console.error(`[worker] barrier check failed after job ${job.id}`, error);
  }
}

/**
 * Fires any notification this settled job has earned.
 *
 * `notifyForSettledJob` already swallows its own failures; the try/catch here
 * guards the call itself, so that even an unexpected throw — a bad import, an
 * exhausted connection pool — cannot end a drain that still has a queue to
 * work through.
 */
async function notifySettled(
  db: ReturnType<typeof createAdminClient>,
  job: AnalysisJob,
  memo: NotifyMemo,
): Promise<void> {
  try {
    await notifyForSettledJob(db, job, memo);
  } catch (error) {
    console.error(`[worker] notification failed after job ${job.id}`, error);
  }
}

/**
 * Fails a job without letting the failure path itself throw.
 *
 * If `fail_job()` is unreachable the job stays in GENERATING, and
 * `reap_stale_jobs()` is the backstop that returns it to the queue.
 */
async function safeFail(
  db: ReturnType<typeof createAdminClient>,
  jobId: string,
  message: string,
): Promise<void> {
  try {
    await failJob(db, jobId, message.slice(0, 2000));
  } catch (error) {
    console.error(`[worker] could not mark job ${jobId} failed`, error);
  }
}
