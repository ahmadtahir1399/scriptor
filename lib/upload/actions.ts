"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertOwnsUpload,
  createAnalysis,
  createEntitlements,
  createPaper,
  createUpload,
  getLatestAnalysisId,
  requeueFailedJobs,
  setCurrentUpload,
} from "@/lib/db/queries/uploads";
import { getPaper } from "@/lib/db/queries/papers";
import { enqueueJob } from "@/lib/db/queries/jobs";
import { logUploadEvent } from "@/lib/db/queries/ingestion";
import { buildUploadPath, createSignedUploadUrl } from "@/lib/upload/storage";
import { kickWorker } from "@/lib/jobs/kick";
import {
  CITATION_STYLE_AUTO,
  retryIngestionSchema,
  uploadSettingsSchema,
  type UploadSettings,
} from "@/lib/validations/upload";

/**
 * Upload server actions.
 *
 * Every action re-derives the user from the session and re-verifies ownership
 * of any id it receives. An id arriving from the client is user input — RLS
 * would stop a cross-user write anyway, but checking here turns a silent empty
 * result into a clear error.
 */

export type UploadActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export interface PreparedUpload {
  uploadId: string;
  paperId: string;
  analysisId: string;
  /** Short-lived; the browser PUTs the file straight to storage. */
  signedUrl: string;
  token: string;
  path: string;
}

/**
 * Step 1 — reserve the rows and hand back a signed upload URL.
 *
 * The file itself does not pass through this action. Streaming 50 MB through a
 * serverless function would hit both the body-size cap and the execution
 * timeout, so the browser uploads directly to storage and then calls
 * `finaliseUpload()`.
 */
export async function prepareUpload(
  settings: UploadSettings,
  /**
   * When present, this upload is a NEW VERSION of an existing paper: the row is
   * bound to that paper instead of creating a new one. Ownership of the paper is
   * re-verified server-side — a client cannot attach a version to someone else's
   * paper. Absent for a first upload.
   */
  paperId?: string,
): Promise<UploadActionResult<PreparedUpload>> {
  const parsed = uploadSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid upload settings.",
    };
  }

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    // upload_entitlements and paper_analyses are "written by the server,
    // read-only to the user" by design (see 15_rls.sql): they grant only SELECT
    // to `authenticated`, so inserting them through the user client fails with
    // "permission denied for table". Their user_id is stamped by a BEFORE INSERT
    // trigger from the parent upload, so the service role writes them without
    // losing ownership — same rationale as finaliseUpload's job writes.
    const admin = createAdminClient();

    const values = parsed.data;

    // Title starts as the filename minus its extension; the student renames it
    // later. An untitled paper in a list is worse than an approximate name.
    const title =
      values.fileName.replace(/\.pdf$/i, "").trim() || values.fileName;

    // New version → bind to the caller's existing paper (ownership re-verified);
    // first upload → create a fresh paper.
    let paper;
    if (paperId) {
      const existing = await getPaper(db, paperId);
      if (!existing || existing.user_id !== user.id) {
        return { ok: false, error: "That paper was not found." };
      }
      paper = existing;
    } else {
      paper = await createPaper(db, user.id, title);
    }

    // Path is built from the SESSION user id, never from client input — the
    // storage policy compares the first segment against auth.uid().
    const uploadId = crypto.randomUUID();
    const path = buildUploadPath(user.id, uploadId);

    const upload = await createUpload(db, {
      paperId: paper.id,
      filePath: path,
      fileName: values.fileName,
      fileSizeBytes: values.fileSizeBytes,
      documentTypeCode: values.documentTypeCode,
      locale: values.locale,
      spelling: values.spelling,
      citationStyle:
        values.citationStyle === CITATION_STYLE_AUTO
          ? null
          : values.citationStyle,
      selectedCheckIds: values.checkIds,
      autoDelete: values.autoDelete,
      sendEmailResults: values.sendEmailResults,
    });

    await createEntitlements(admin, upload.id);

    const analysis = await createAnalysis(admin, {
      paperId: paper.id,
      uploadId: upload.id,
    });

    await setCurrentUpload(db, paper.id, upload.id, analysis.id);

    const { signedUrl, token } = await createSignedUploadUrl(path);

    return {
      ok: true,
      data: {
        uploadId: upload.id,
        paperId: paper.id,
        analysisId: analysis.id,
        signedUrl,
        token,
        path,
      },
    };
  } catch (error) {
    console.error("[upload] prepareUpload failed", error);
    return {
      ok: false,
      error: "Could not start the upload. Please try again.",
    };
  }
}

/**
 * Step 2 — the bytes have landed; start ingestion.
 *
 * Enqueues PARSE only. The rest of the pipeline chains itself: PARSE enqueues
 * IDENTIFY_PAGES, which enqueues COMPATIBILITY. Enqueueing all three up front
 * would let them be claimed out of order by concurrent workers.
 */
export async function finaliseUpload(
  uploadId: string,
): Promise<UploadActionResult<{ started: boolean }>> {
  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const upload = await assertOwnsUpload(db, uploadId, user.id);

    // Job writes need the service role: analysis_jobs has RLS on and no user
    // policy, by design.
    const admin = createAdminClient();

    const analysisId = await getLatestAnalysisId(admin, upload.id);
    if (!analysisId) {
      return { ok: false, error: "No analysis found for this upload." };
    }

    await enqueueJob(admin, {
      paperAnalysisId: analysisId,
      paperUploadId: upload.id,
      kind: "PARSE",
    });

    await logUploadEvent(admin, upload.id, "upload_completed", {
      bytes: upload.file_size_bytes,
    });

    // Fire-and-forget so the student is not waiting on the first job to start.
    kickWorker();

    revalidatePath("/papers");

    return { ok: true, data: { started: true } };
  } catch (error) {
    console.error("[upload] finaliseUpload failed", error);
    return {
      ok: false,
      error: "Could not start processing. Please try again.",
    };
  }
}

/** Resets failed ingestion jobs and re-kicks the worker. */
export async function retryIngestion(
  input: unknown,
): Promise<UploadActionResult<{ requeued: number }>> {
  const parsed = retryIngestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    await assertOwnsUpload(db, parsed.data.uploadId, user.id);

    const admin = createAdminClient();

    const analysisId = await getLatestAnalysisId(admin, parsed.data.uploadId);
    if (!analysisId) {
      return { ok: false, error: "No analysis found for this upload." };
    }

    const requeued = await requeueFailedJobs(admin, analysisId);
    kickWorker();

    return { ok: true, data: { requeued } };
  } catch (error) {
    console.error("[upload] retryIngestion failed", error);
    return { ok: false, error: "Could not retry. Please try again." };
  }
}
