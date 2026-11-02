import "server-only";

import { getAnalysis } from "@/lib/db/queries/analyses";
import { getUpload } from "@/lib/db/queries/papers";
import { listJobsForAnalysis } from "@/lib/db/queries/jobs";
import { isJobTerminal } from "@/lib/domain/job";
import {
  notifyAnalysisComplete,
  notifyAnalysisFailed,
  notifyReferenceIssues,
  notifyUploadIncompatible,
} from "@/lib/notifications/events";
import type { AnalysisJob } from "@/lib/domain/job";
import type { Db } from "@/lib/db/queries/papers";

/**
 * The bridge between the job queue and the notification layer.
 *
 * ── WHY THIS IS DRIVEN BY JOBS SETTLING, NOT BY A STATUS CHANGE ──────────────
 *
 * The obvious design is a database trigger on `paper_analyses.status`. It does
 * not work, for a reason that is invisible until you trace the pipeline:
 * INGESTION ALSO FLIPS THE ANALYSIS TO DONE.
 *
 * PARSE, IDENTIFY_PAGES and COMPATIBILITY are jobs on the same
 * `paper_analysis_id`. When the third of them finishes,
 * `recompute_analysis_status()` sees every required job terminal and writes
 * DONE — before a single check has run. That is by design (`resetAnalysisForRun`
 * exists precisely to clear it again), but it means "status became DONE" fires
 * twice per analysis, and the first one is not a finished review. A trigger on
 * it would email every student "your review is ready" the moment their upload
 * finished parsing, with no score and no findings.
 *
 * So completion is gated on something only a real review produces: a settled,
 * successful POST_PROCESSING job. Failure is not gated the same way, because a
 * required job that dies at PARSE never reaches post-processing and that
 * student still needs to be told.
 *
 * ── CALLED AFTER THE JOB'S OWN STATUS IS COMMITTED ───────────────────────────
 *
 * Same ordering requirement as `maybeEnqueuePostProcessing`, and for the same
 * reason: this re-reads the queue to decide whether the analysis is finished, so
 * it is only correct once the settling job is DONE/ERROR in the database. The
 * runner calls it from the same place it advances the barrier.
 */

/**
 * Per-drain memo of analyses already handled.
 *
 * A drain settles many jobs, and several of them can settle the same analysis.
 * `dispatchNotification` dedupes correctly on its own, but it costs a round trip
 * each time; this makes the repeat case free. It is per-invocation state, NOT a
 * cache — two workers, or two drains, each start empty, and correctness never
 * depends on it because the database dedupe is the real guard.
 */
export type NotifyMemo = Set<string>;

export function createNotifyMemo(): NotifyMemo {
  return new Set<string>();
}

/**
 * Fires whatever notification this settled job has earned. Never throws.
 *
 * Isolated exactly like `advanceBarrier`: a notification failure must not take
 * down a drain loop that is still working through the rest of the queue.
 */
export async function notifyForSettledJob(
  db: Db,
  job: AnalysisJob,
  memo: NotifyMemo,
): Promise<void> {
  try {
    switch (job.kind) {
      case "COMPATIBILITY":
        await handleCompatibility(db, job, memo);
        break;
      case "REFERENCE_HEALTH":
        await handleReferenceHealth(db, job, memo);
        break;
      default:
        break;
    }

    // Checked after every kind, not just POST_PROCESSING — a required job that
    // exhausts its retries at PARSE is a failed analysis nobody would otherwise
    // hear about.
    await handleAnalysisTerminal(db, job, memo);
  } catch (error) {
    console.error(
      `[notifications] post-job dispatch failed for ${job.kind} (${job.id})`,
      error,
    );
  }
}

/** Rejected uploads. The job SUCCEEDS — the verdict lives on the upload row. */
async function handleCompatibility(
  db: Db,
  job: AnalysisJob,
  memo: NotifyMemo,
): Promise<void> {
  const key = `incompatible:${job.paper_upload_id}`;
  if (memo.has(key)) return;

  const upload = await getUpload(db, job.paper_upload_id);
  // Strict false, not falsy: null means the check has not run yet, and an
  // upload mid-pipeline must not be reported as rejected.
  if (upload?.is_compatible !== false) return;

  memo.add(key);
  await notifyUploadIncompatible(db, job.paper_upload_id);
}

/**
 * Reference verification. `notifyReferenceIssues` decides whether there is
 * anything worth saying — a clean bibliography sends nothing.
 */
async function handleReferenceHealth(
  db: Db,
  job: AnalysisJob,
  memo: NotifyMemo,
): Promise<void> {
  if (job.status !== "DONE") return;

  const key = `references:${job.paper_analysis_id}`;
  if (memo.has(key)) return;
  memo.add(key);

  await notifyReferenceIssues(db, job.paper_analysis_id);
}

/** Completion and failure, both decided from the analysis's settled state. */
async function handleAnalysisTerminal(
  db: Db,
  job: AnalysisJob,
  memo: NotifyMemo,
): Promise<void> {
  const key = `analysis:${job.paper_analysis_id}`;
  if (memo.has(key)) return;

  const analysis = await getAnalysis(db, job.paper_analysis_id);
  if (!analysis || analysis.status === "GENERATING") return;

  if (analysis.status === "ERROR") {
    memo.add(key);
    await notifyAnalysisFailed(db, job.paper_analysis_id);
    return;
  }

  // DONE. Only a completed POST_PROCESSING makes this a finished REVIEW rather
  // than a finished INGESTION — see the header note.
  const jobs = await listJobsForAnalysis(db, job.paper_analysis_id);
  const postProcessing = jobs.find(
    (candidate) => candidate.kind === "POST_PROCESSING",
  );

  if (!postProcessing || !isJobTerminal(postProcessing)) return;
  if (postProcessing.status !== "DONE") return;

  memo.add(key);
  await notifyAnalysisComplete(db, job.paper_analysis_id);
}
