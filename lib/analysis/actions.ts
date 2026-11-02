"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertOwnsUpload,
  getLatestAnalysisId,
} from "@/lib/db/queries/uploads";
import { getUpload } from "@/lib/db/queries/papers";
import { listChecksForDocumentType } from "@/lib/db/queries/checks";
import { getAnalysis, resetAnalysisForRun } from "@/lib/db/queries/analyses";
import { listJobsForAnalysis } from "@/lib/db/queries/jobs";
import { enqueueAnalysis } from "@/lib/analysis/enqueue";
import { kickWorker } from "@/lib/jobs/kick";
import type { AppLocale } from "@/lib/db/enums";

/**
 * The "Start analysis" action — this is what the disabled P3 CTA becomes.
 *
 * Security, in order, all against the SERVER session and never a client id:
 *   1. ownership of the upload,
 *   2. is_compatible = true (never spend money on a document the gate rejected),
 *   3. no analysis already running for this upload (a second concurrent start
 *      is REJECTED, not queued — double-clicking must not double-charge).
 *
 * The `paper_analyses` row already exists from upload time. This resets it to
 * GENERATING and fans out the check jobs; it does not create a second analysis.
 */

export type StartAnalysisResult =
  | { ok: true; analysisId: string; checkJobs: number }
  | {
      ok: false;
      error:
        | "not_found"
        | "incompatible"
        | "already_running"
        | "no_checks"
        | "unknown";
    };

export async function startAnalysis(
  uploadId: string,
): Promise<StartAnalysisResult> {
  try {
    const user = await requireSessionUser();
    const db = await createClient();

    // 1. Ownership.
    const upload = await assertOwnsUpload(db, uploadId, user.id);

    // 2. Compatibility gate.
    if (upload.is_compatible !== true) {
      return { ok: false, error: "incompatible" };
    }

    const analysisId = await getLatestAnalysisId(db, uploadId);
    if (!analysisId) {
      return { ok: false, error: "not_found" };
    }

    // Job and analysis writes need the service role — analysis_jobs has no user
    // policy, and the score/status columns are not user-writable.
    const admin = createAdminClient();

    // 3. Concurrency guard: reject if check jobs are already in flight.
    const existingJobs = await listJobsForAnalysis(admin, analysisId);
    const running = existingJobs.some(
      (job) =>
        (job.kind === "RUN_CHECK" || job.kind === "GRAMMAR") &&
        (job.status === "NONE" || job.status === "GENERATING"),
    );
    if (running) {
      return { ok: false, error: "already_running" };
    }

    // Which checks. Prefer the student's stored selection; fall back to every
    // check for the document type so a missing selection still analyses.
    const checkIds = await resolveCheckIds(
      admin,
      upload.selected_check_ids,
      upload.document_type_code,
    );
    if (checkIds.length === 0) {
      return { ok: false, error: "no_checks" };
    }

    // Reset the analysis out of its post-ingestion DONE state, then fan out.
    await resetAnalysisForRun(admin, analysisId);

    const { checkJobs } = await enqueueAnalysis(admin, {
      analysisId,
      uploadId,
      checkIds,
      locale: (upload.locale ?? "EN") as AppLocale,
      wordCount: upload.word_count ?? 0,
    });

    kickWorker();

    revalidatePath(`/upload/${uploadId}`);

    return { ok: true, analysisId, checkJobs };
  } catch (error) {
    console.error("[analysis] startAnalysis failed", error);
    return { ok: false, error: "unknown" };
  }
}

async function resolveCheckIds(
  db: ReturnType<typeof createAdminClient>,
  selected: readonly string[],
  documentTypeCode: string | null,
): Promise<string[]> {
  if (selected.length > 0) return [...selected];

  if (!documentTypeCode) return [];
  const checks = await listChecksForDocumentType(db, documentTypeCode);
  return checks
    .map((check) => check.id)
    .filter((id): id is string => id !== null);
}

/** Re-kicks a stalled analysis whose worker never picked the jobs up. */
export async function nudgeAnalysis(
  uploadId: string,
): Promise<{ ok: boolean }> {
  try {
    const user = await requireSessionUser();
    const db = await createClient();
    await assertOwnsUpload(db, uploadId, user.id);

    const analysisId = await getLatestAnalysisId(db, uploadId);
    if (!analysisId) return { ok: false };

    const analysis = await getAnalysis(db, analysisId);
    if (analysis?.status !== "GENERATING") return { ok: false };

    kickWorker();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
