import type { JobStatus } from "@/lib/db/enums";
import type { TablesInsert } from "@/lib/db/types.generated";
import type {
  Requirement,
  RequirementFile,
  RequirementFileWithRequirements,
  RequirementWithResult,
  UploadRequirement,
} from "@/lib/domain/requirement";
import type { Db } from "@/lib/db/queries/papers";

/** Requirements aggregate reads — P11. */

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export async function listRequirementFiles(db: Db): Promise<RequirementFile[]> {
  const result = await db
    .from("requirement_files")
    .select("*")
    .order("created_at", { ascending: false });

  return unwrap(result, "listRequirementFiles");
}

export async function getRequirementFile(
  db: Db,
  requirementFileId: string,
): Promise<RequirementFileWithRequirements | null> {
  const result = await db
    .from("requirement_files")
    .select("*, requirements(*)")
    .eq("id", requirementFileId)
    .maybeSingle();

  return unwrap(
    result,
    "getRequirementFile",
  ) as unknown as RequirementFileWithRequirements | null;
}

export async function listRequirements(
  db: Db,
  requirementFileId: string,
  enabledOnly = false,
): Promise<Requirement[]> {
  let query = db
    .from("requirements")
    .select("*")
    .eq("requirement_file_id", requirementFileId);

  if (enabledOnly) {
    query = query.eq("is_enabled", true);
  }

  const result = await query.order("sort_order", { ascending: true });
  return unwrap(result, "listRequirements");
}

/**
 * Requirements applied to an upload, each with how the document scored.
 *
 * The result side is nullable: a requirement attached but not yet graded has no
 * `upload_requirements` row. `summariseRequirements()` treats that as pending
 * rather than satisfied, which matters — reporting an unevaluated requirement
 * as passed is the worst mistake this feature could make.
 */
export async function listRequirementsForUpload(
  db: Db,
  uploadId: string,
): Promise<RequirementWithResult[]> {
  const linkResult = await db
    .from("upload_requirements")
    .select("*, requirement:requirements(*)")
    .eq("paper_upload_id", uploadId);

  const links = unwrap(
    linkResult,
    "listRequirementsForUpload",
  ) as unknown as Array<
    RequirementWithResult["upload_requirement"] & {
      requirement: Requirement | null;
    }
  >;

  const items: RequirementWithResult[] = [];
  for (const link of links) {
    if (!link || !link.requirement) continue;
    const { requirement, ...uploadRequirement } = link;
    items.push({ ...requirement, upload_requirement: uploadRequirement });
  }

  return items.sort((a, b) => a.sort_order - b.sort_order);
}

/** Every requirement the student owns, across every file — the library view. */
export async function listAllRequirements(db: Db): Promise<Requirement[]> {
  const result = await db
    .from("requirements")
    .select("*")
    .order("category", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });

  return unwrap(result, "listAllRequirements");
}

/** Requirements the student has enabled, across every file they own. */
export async function listActiveRequirements(db: Db): Promise<Requirement[]> {
  const result = await db
    .from("requirements")
    .select("*")
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });

  return unwrap(result, "listActiveRequirements");
}

export async function getRequirement(
  db: Db,
  requirementId: string,
): Promise<Requirement | null> {
  const result = await db
    .from("requirements")
    .select("*")
    .eq("id", requirementId)
    .maybeSingle();
  return unwrap(result, "getRequirement");
}

export async function getRequirementFileMeta(
  db: Db,
  requirementFileId: string,
): Promise<RequirementFile | null> {
  const result = await db
    .from("requirement_files")
    .select("*")
    .eq("id", requirementFileId)
    .maybeSingle();
  return unwrap(result, "getRequirementFileMeta");
}

/** The suffix that marks a user's synthetic container for manual requirements. */
export const MANUAL_FILE_SUFFIX = "/manual/manual";

/** Finds the user's manual-requirements container file, if it exists yet. */
export async function findManualRequirementFile(
  db: Db,
  userId: string,
): Promise<RequirementFile | null> {
  const result = await db
    .from("requirement_files")
    .select("*")
    .eq("user_id", userId)
    .like("file_path", `%${MANUAL_FILE_SUFFIX}`)
    .maybeSingle();
  return unwrap(result, "findManualRequirementFile");
}

// ===========================================================================
// Writes — P9. File and requirement CRUD is user-writable under P1's RLS, so
// most of these run on the user-session client. The extraction result path
// (status + requirement rows) runs in the worker under the service role, and
// the grading of upload_requirements is service-role-only (users get
// select/insert/delete, never update).
// ===========================================================================

/**
 * Creates the guideline-file row. `id` is supplied by the caller because the
 * storage path — {user_id}/{id}/{filename} — is built from it before the row
 * exists. `user_id` is NOT set by a trigger on this table, so it is passed
 * explicitly and checked against auth.uid() by the insert policy.
 */
export async function createRequirementFile(
  db: Db,
  args: {
    id: string;
    userId: string;
    filePath: string;
    fileName: string;
    fileSizeBytes: number;
    title: string;
  },
): Promise<RequirementFile> {
  const result = await db
    .from("requirement_files")
    .insert({
      id: args.id,
      user_id: args.userId,
      file_path: args.filePath,
      file_name: args.fileName,
      file_format: "PDF",
      file_size_bytes: args.fileSizeBytes,
      title: args.title,
      extraction_status: "NONE",
    })
    .select()
    .single();

  return unwrap(result, "createRequirementFile");
}

/** Sets the extraction status (and error / extracted_at) on a guideline file. */
export async function setRequirementFileStatus(
  db: Db,
  requirementFileId: string,
  status: JobStatus,
  error: string | null = null,
): Promise<void> {
  const result = await db
    .from("requirement_files")
    .update({
      extraction_status: status,
      extraction_error: error,
      extracted_at: status === "DONE" ? new Date().toISOString() : null,
    })
    .eq("id", requirementFileId);

  if (result.error)
    throw new Error(`setRequirementFileStatus: ${result.error.message}`);
}

export async function deleteRequirementFile(
  db: Db,
  requirementFileId: string,
): Promise<void> {
  const result = await db
    .from("requirement_files")
    .delete()
    .eq("id", requirementFileId);
  if (result.error)
    throw new Error(`deleteRequirementFile: ${result.error.message}`);
}

/** Clears a file's extracted requirements — idempotency for a re-extract. */
export async function clearRequirementsForFile(
  db: Db,
  requirementFileId: string,
): Promise<void> {
  const result = await db
    .from("requirements")
    .delete()
    .eq("requirement_file_id", requirementFileId);
  if (result.error)
    throw new Error(`clearRequirementsForFile: ${result.error.message}`);
}

export interface RequirementInsert {
  title: string;
  description: string;
  category: string | null;
  sourceQuote: string | null;
  isMandatory: boolean;
  sortOrder: number;
}

/** Bulk-inserts extracted requirements. `user_id` is stamped by the trigger. */
export async function insertRequirements(
  db: Db,
  requirementFileId: string,
  requirements: readonly RequirementInsert[],
): Promise<number> {
  if (requirements.length === 0) return 0;

  const rows: TablesInsert<"requirements">[] = requirements.map(
    (requirement) => ({
      requirement_file_id: requirementFileId,
      title: requirement.title,
      description: requirement.description,
      category: requirement.category,
      source_quote: requirement.sourceQuote,
      is_mandatory: requirement.isMandatory,
      sort_order: requirement.sortOrder,
    }),
  );

  const result = await db.from("requirements").insert(rows);
  if (result.error)
    throw new Error(`insertRequirements: ${result.error.message}`);
  return rows.length;
}

/** Creates one manually-authored requirement. */
export async function createRequirement(
  db: Db,
  args: {
    requirementFileId: string;
    title: string;
    description: string;
    category: string | null;
    sourceQuote: string | null;
    isMandatory: boolean;
    sortOrder: number;
  },
): Promise<Requirement> {
  const result = await db
    .from("requirements")
    .insert({
      requirement_file_id: args.requirementFileId,
      title: args.title,
      description: args.description,
      category: args.category,
      source_quote: args.sourceQuote,
      is_mandatory: args.isMandatory,
      sort_order: args.sortOrder,
    })
    .select()
    .single();

  return unwrap(result, "createRequirement");
}

export async function updateRequirement(
  db: Db,
  requirementId: string,
  patch: Partial<{
    title: string;
    description: string;
    category: string | null;
    is_mandatory: boolean;
    is_enabled: boolean;
    sort_order: number;
  }>,
): Promise<void> {
  const result = await db
    .from("requirements")
    .update(patch)
    .eq("id", requirementId);
  if (result.error)
    throw new Error(`updateRequirement: ${result.error.message}`);
}

export async function deleteRequirement(
  db: Db,
  requirementId: string,
): Promise<void> {
  const result = await db.from("requirements").delete().eq("id", requirementId);
  if (result.error)
    throw new Error(`deleteRequirement: ${result.error.message}`);
}

// --- upload_requirements (attach + grade) ----------------------------------

/**
 * Attaches a set of requirements to an upload. Upserts on the unique
 * (upload, requirement) constraint so re-applying is idempotent. `user_id` is
 * stamped by the trigger; the grading columns stay null until the worker runs.
 */
export async function attachRequirements(
  db: Db,
  uploadId: string,
  requirementIds: readonly string[],
): Promise<void> {
  if (requirementIds.length === 0) return;

  const rows: TablesInsert<"upload_requirements">[] = requirementIds.map(
    (requirementId) => ({
      paper_upload_id: uploadId,
      requirement_id: requirementId,
      status: "NONE",
    }),
  );

  const result = await db
    .from("upload_requirements")
    .upsert(rows, {
      onConflict: "paper_upload_id,requirement_id",
      ignoreDuplicates: true,
    });

  if (result.error)
    throw new Error(`attachRequirements: ${result.error.message}`);
}

/** Removes every requirement attached to an upload — used before re-applying. */
export async function detachAllRequirements(
  db: Db,
  uploadId: string,
): Promise<void> {
  const result = await db
    .from("upload_requirements")
    .delete()
    .eq("paper_upload_id", uploadId);
  if (result.error)
    throw new Error(`detachAllRequirements: ${result.error.message}`);
}

/** Flips the upload's custom-requirements flag. */
export async function setUploadCustomRequirements(
  db: Db,
  uploadId: string,
  enabled: boolean,
): Promise<void> {
  const result = await db
    .from("paper_uploads")
    .update({ use_custom_requirements: enabled })
    .eq("id", uploadId);
  if (result.error)
    throw new Error(`setUploadCustomRequirements: ${result.error.message}`);
}

export async function getUploadRequirement(
  db: Db,
  uploadRequirementId: string,
): Promise<UploadRequirement | null> {
  const result = await db
    .from("upload_requirements")
    .select("*")
    .eq("id", uploadRequirementId)
    .maybeSingle();
  return unwrap(result, "getUploadRequirement");
}

/** Marks a requirement check as running and binds it to the analysis. */
export async function setUploadRequirementRunning(
  db: Db,
  uploadRequirementId: string,
  analysisId: string,
): Promise<void> {
  const result = await db
    .from("upload_requirements")
    .update({ status: "GENERATING", paper_analysis_id: analysisId })
    .eq("id", uploadRequirementId);
  if (result.error)
    throw new Error(`setUploadRequirementRunning: ${result.error.message}`);
}

/** Writes a requirement's grading verdict. Service-role only. */
export async function completeUploadRequirement(
  db: Db,
  uploadRequirementId: string,
  verdict: {
    isSatisfied: boolean;
    evidenceQuote: string | null;
    explanation: string;
    pageNumber: number | null;
  },
): Promise<void> {
  const result = await db
    .from("upload_requirements")
    .update({
      status: "DONE",
      is_satisfied: verdict.isSatisfied,
      evidence_quote: verdict.evidenceQuote,
      explanation: verdict.explanation,
      page_number: verdict.pageNumber,
    })
    .eq("id", uploadRequirementId);
  if (result.error)
    throw new Error(`completeUploadRequirement: ${result.error.message}`);
}

/** Marks a requirement check errored — the finding is unknown, not a pass. */
export async function failUploadRequirement(
  db: Db,
  uploadRequirementId: string,
  reason: string,
): Promise<void> {
  const result = await db
    .from("upload_requirements")
    .update({
      status: "ERROR",
      is_satisfied: null,
      explanation: reason.slice(0, 500),
    })
    .eq("id", uploadRequirementId);
  if (result.error)
    throw new Error(`failUploadRequirement: ${result.error.message}`);
}
