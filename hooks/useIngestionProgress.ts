"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import type { JobKind, JobStatus } from "@/lib/db/enums";
import { useWorkerNudge } from "@/hooks/useWorkerNudge";

/**
 * Live ingestion progress.
 *
 * ---------------------------------------------------------------------------
 * POLLING ONLY. DO NOT ADD A REALTIME SUBSCRIPTION HERE.
 * ---------------------------------------------------------------------------
 * `analysis_jobs` is in the Realtime publication, but it has NO user RLS policy
 * — migration 16 says its events "reach service-role subscribers only", which
 * is the admin queue monitor. A browser subscription to that table connects
 * happily, reports SUBSCRIBED, and then receives nothing for the rest of time.
 *
 * That was actively harmful, not merely useless: this hook used to treat the
 * socket as primary and disable polling once `isConnected` flipped true. So the
 * socket connected, polling stopped, no events ever arrived, and the page froze
 * on whatever the first poll happened to catch — showing "Not started" against
 * a stage the worker had in fact finished seconds later. That is the "stuck on
 * the uploading screen" bug.
 *
 * The polling route (`/api/ingestion/[uploadId]`) exists precisely because the
 * browser cannot read this table: it proves ownership with the user's client,
 * then reads the jobs with service-role. It is the only channel that works.
 */

export const INGESTION_STAGES: readonly JobKind[] = [
  "PARSE",
  "IDENTIFY_PAGES",
  "COMPATIBILITY",
];

export interface StageProgress {
  kind: JobKind;
  status: JobStatus;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface IngestionProgress {
  stages: StageProgress[];
  isComplete: boolean;
  hasFailed: boolean;
}

interface JobRow {
  id: string;
  kind: JobKind;
  status: JobStatus;
  claimed_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  attempts: number;
  max_attempts: number;
}

export function useIngestionProgress(uploadId: string): IngestionProgress {
  const { data: polledJobs } = useQuery({
    queryKey: ["ingestion-jobs", uploadId],
    queryFn: async (): Promise<JobRow[]> => {
      const response = await fetch(`/api/ingestion/${uploadId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load ingestion state");
      const body: { jobs: JobRow[] } = await response.json();
      return body.jobs;
    },
    /*
     * Stop only when COMPATIBILITY — the last ingestion stage — is terminal.
     *
     * "Every job is terminal" is NOT a safe stopping condition here: the stages
     * are chained, so at the instant PARSE completes it is the only row in the
     * table and every row is terminal. Polling would stop before IDENTIFY_PAGES
     * had even been enqueued.
     */
    refetchInterval: (query) => {
      const jobs = query.state.data;
      if (!jobs) return 2000;
      const compatibility = jobs.find((job) => job.kind === "COMPATIBILITY");
      if (compatibility && isTerminal(compatibility)) return false;
      if (jobs.some((job) => job.status === "ERROR" && job.attempts >= job.max_attempts)) {
        return false;
      }
      return 2000;
    },
  });

  const jobs = React.useMemo(() => polledJobs ?? [], [polledJobs]);

  const compatibilityDone =
    jobs.find((job) => job.kind === "COMPATIBILITY")?.status === "DONE";
  const permanentlyFailed = jobs.some(
    (job) => job.status === "ERROR" && job.attempts >= job.max_attempts,
  );

  /*
   * Restart the stall clock whenever any job changes state. Ingestion is three
   * chained jobs, so "nothing has changed in twelve seconds while COMPATIBILITY
   * has not finished" is a reliable signal that nobody woke the worker.
   */
  useWorkerNudge({
    uploadId,
    isPending: !compatibilityDone && !permanentlyFailed,
    progressKey: jobs.map((job) => `${job.kind}:${job.status}:${job.attempts}`).sort().join("|"),
  });

  return React.useMemo(() => {
    const byKind = new Map(jobs.map((job) => [job.kind, job]));

    const stages: StageProgress[] = INGESTION_STAGES.map((kind) => {
      const job = byKind.get(kind);
      return {
        kind,
        // A stage with no row yet has not been enqueued — NONE, not failed.
        status: job?.status ?? "NONE",
        startedAt: job?.claimed_at ?? null,
        completedAt: job?.completed_at ?? null,
        error: job?.last_error ?? null,
      };
    });

    const compatibility = byKind.get("COMPATIBILITY");

    return {
      stages,
      isComplete: compatibility?.status === "DONE",
      // Only a permanently failed job counts; one awaiting backoff is still trying.
      hasFailed: jobs.some(
        (job) => job.status === "ERROR" && job.attempts >= job.max_attempts,
      ),
    };
  }, [jobs]);
}

function isTerminal(job: JobRow): boolean {
  return job.status === "DONE" || (job.status === "ERROR" && job.attempts >= job.max_attempts);
}
