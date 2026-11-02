import "server-only";

import type { CitationStyle, AppLocale, SpellingVariant } from "@/lib/db/enums";
import type { Tables } from "@/lib/db/types.generated";
import type { Db } from "@/lib/db/queries/papers";

/**
 * Upload aggregate writes.
 *
 * Separate from `papers.ts` (which is reads) purely for size. Same rule
 * applies: no inline `.from()` anywhere outside `lib/db/queries`.
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

export async function createPaper(
  db: Db,
  userId: string,
  title: string,
): Promise<Tables<"papers">> {
  const result = await db
    .from("papers")
    .insert({ user_id: userId, title })
    .select()
    .single();

  return unwrap(result, "createPaper");
}

export interface CreateUploadArgs {
  paperId: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  documentTypeCode: string;
  locale: AppLocale;
  spelling: SpellingVariant;
  /** Null means "detect it" — the student was unsure. */
  citationStyle: CitationStyle | null;
  selectedCheckIds: string[];
  autoDelete: boolean;
  sendEmailResults: boolean;
}

/**
 * Creates the upload row.
 *
 * `user_id` is omitted deliberately: P1's `set_user_id_from_paper()` trigger
 * derives it from the parent paper and overwrites anything supplied, so the
 * client cannot claim someone else's ownership even if it tried.
 */
export async function createUpload(
  db: Db,
  args: CreateUploadArgs,
): Promise<Tables<"paper_uploads">> {
  const result = await db
    .from("paper_uploads")
    .insert({
      paper_id: args.paperId,
      file_path: args.filePath,
      file_name: args.fileName,
      file_format: "PDF",
      file_size_bytes: args.fileSizeBytes,
      document_type_code: args.documentTypeCode,
      locale: args.locale,
      spelling: args.spelling,
      citation_style: args.citationStyle,
      selected_check_ids: args.selectedCheckIds,
      auto_delete: args.autoDelete,
      send_email_results: args.sendEmailResults,
    })
    .select()
    .single();

  return unwrap(result, "createUpload");
}

/**
 * Write-once entitlement snapshot.
 *
 * No billing yet, so every flag is true and source is FREE. The row exists
 * anyway because entitlement is decided ONCE at upload time — see the note in
 * docs/SCHEMA.md.
 */
export async function createEntitlements(
  db: Db,
  uploadId: string,
): Promise<void> {
  const result = await db
    .from("upload_entitlements")
    .insert({ paper_upload_id: uploadId, tier: "FREE", source: "FREE" });

  if (result.error) {
    throw new Error(`createEntitlements: ${result.error.message}`);
  }
}

/**
 * Creates the analysis row.
 *
 * Created at upload time, before ingestion starts, so the progress page has a
 * Realtime subscription target from the very first render. All sub-statuses
 * stay NONE — P4 flips the ones the student requested.
 */
export async function createAnalysis(
  db: Db,
  args: { paperId: string; uploadId: string },
): Promise<Tables<"paper_analyses">> {
  const result = await db
    .from("paper_analyses")
    .insert({
      paper_id: args.paperId,
      paper_upload_id: args.uploadId,
      status: "GENERATING",
    })
    .select()
    .single();

  return unwrap(result, "createAnalysis");
}

/** Points the paper at its newest draft and analysis. */
export async function setCurrentUpload(
  db: Db,
  paperId: string,
  uploadId: string,
  analysisId: string,
): Promise<void> {
  const result = await db
    .from("papers")
    .update({ current_upload_id: uploadId, current_analysis_id: analysisId })
    .eq("id", paperId);

  if (result.error) {
    throw new Error(`setCurrentUpload: ${result.error.message}`);
  }
}

/**
 * Ownership re-check for server actions.
 *
 * Every action that takes an upload id from the client calls this. An id is
 * user input; RLS would block a cross-user read anyway, but failing here gives
 * a clear error instead of a confusing empty result.
 */
export async function assertOwnsUpload(
  db: Db,
  uploadId: string,
  userId: string,
): Promise<Tables<"paper_uploads">> {
  const result = await db
    .from("paper_uploads")
    .select("*")
    .eq("id", uploadId)
    .maybeSingle();

  const upload = unwrap(result, "assertOwnsUpload");

  if (!upload || upload.user_id !== userId) {
    throw new Error("Upload not found.");
  }

  return upload;
}

/** Newest analysis for an upload. Returns the id only — callers need nothing else. */
export async function getLatestAnalysisId(
  db: Db,
  uploadId: string,
): Promise<string | null> {
  const result = await db
    .from("paper_analyses")
    .select("id")
    .eq("paper_upload_id", uploadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return unwrap(result, "getLatestAnalysisId")?.id ?? null;
}

/**
 * Renames a paper. Ownership is re-verified by the action before this runs; the
 * caller passes the service-role client, so this write is not gated by whatever
 * user-update policy papers may or may not carry.
 */
export async function updatePaperTitle(
  db: Db,
  paperId: string,
  title: string,
): Promise<void> {
  const result = await db.from("papers").update({ title }).eq("id", paperId);
  if (result.error) {
    throw new Error(`updatePaperTitle: ${result.error.message}`);
  }
}

/**
 * Deletes a paper. The schema's ON DELETE CASCADE removes every upload, page,
 * word, analysis and finding beneath it — there is deliberately no manual
 * multi-table delete here. Irreversible; the action gates it behind a confirm
 * and re-checks ownership first.
 */
export async function deletePaper(db: Db, paperId: string): Promise<void> {
  const result = await db.from("papers").delete().eq("id", paperId);
  if (result.error) {
    throw new Error(`deletePaper: ${result.error.message}`);
  }
}

/** Resets a failed job so the student's "Try again" actually retries. */
export async function requeueFailedJobs(
  db: Db,
  analysisId: string,
): Promise<number> {
  const result = await db
    .from("analysis_jobs")
    .update({
      status: "NONE",
      attempts: 0,
      run_after: new Date().toISOString(),
      claimed_at: null,
      claimed_by: null,
      last_error: null,
    })
    .eq("paper_analysis_id", analysisId)
    .eq("status", "ERROR")
    .select("id");

  if (result.error) {
    throw new Error(`requeueFailedJobs: ${result.error.message}`);
  }

  return result.data?.length ?? 0;
}
