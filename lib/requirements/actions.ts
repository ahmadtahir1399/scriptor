"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertOwnsUpload } from "@/lib/db/queries/uploads";
import {
  MANUAL_FILE_SUFFIX,
  attachRequirements,
  createRequirement as createRequirementRow,
  createRequirementFile,
  deleteRequirement as deleteRequirementRow,
  deleteRequirementFile as deleteRequirementFileRow,
  detachAllRequirements,
  findManualRequirementFile,
  getRequirement,
  getRequirementFile,
  getRequirementFileMeta,
  listAllRequirements,
  listRequirementFiles,
  setRequirementFileStatus,
  setUploadCustomRequirements,
  updateRequirement as updateRequirementRow,
} from "@/lib/db/queries/requirements";
import { runGuidelineExtraction } from "@/lib/jobs/handlers/extractRequirements";
import {
  normaliseCategory,
  MAX_ACTIVE_REQUIREMENTS,
} from "@/lib/requirements/config";
import { requirementStoragePath } from "@/lib/domain/requirement";
import type { RequirementFile } from "@/lib/domain/requirement";
import type { RequirementFileWithRequirements } from "@/lib/domain/requirement";
import type { Requirement } from "@/lib/domain/requirement";
import type { Db } from "@/lib/db/queries/papers";
import { REQUIREMENTS_BUCKET } from "@/lib/upload/constants";
import {
  attachRequirementsSchema,
  deleteRequirementFileSchema,
  deleteRequirementSchema,
  finaliseGuidelineUploadSchema,
  prepareGuidelineUploadSchema,
  reextractRequirementsSchema,
  updateRequirementSchema,
} from "@/lib/validations/requirement";

/**
 * Custom-requirements server actions.
 *
 * Requirement CRUD is user-writable under P1's RLS, so those actions run on the
 * user-session client (RLS enforces ownership). The extraction result path runs
 * under the service role. Every action re-derives the user and re-verifies
 * ownership before writing — an id from the client is input, not authority.
 *
 * Extraction runs INLINE from `finaliseGuidelineUpload` (guideline docs are
 * small), because a file-only job cannot live in `analysis_jobs` — see
 * `lib/jobs/handlers/extractRequirements.ts`.
 */

export type RequirementActionResult =
  { ok: true } | { ok: false; error: string };

export interface PreparedGuidelineUpload {
  requirementFileId: string;
  path: string;
  token: string;
}

// ---------------------------------------------------------------------------
// Library / detail reads
// ---------------------------------------------------------------------------

export interface RequirementsLibrary {
  files: RequirementFile[];
  requirements: Requirement[];
  /** The synthetic container for manual rules, so the UI can label their source. */
  manualFileId: string | null;
}

export async function getRequirementsLibrary(): Promise<RequirementsLibrary> {
  await requireSessionUser();
  const db = await createClient();

  const [files, requirements] = await Promise.all([
    listRequirementFiles(db),
    listAllRequirements(db),
  ]);
  const manualFile =
    files.find((file) => file.file_path.endsWith(MANUAL_FILE_SUFFIX)) ?? null;

  return {
    files: files.filter((file) => file.id !== manualFile?.id),
    requirements,
    manualFileId: manualFile?.id ?? null,
  };
}

export async function getGuidelineFileData(
  requirementFileId: string,
): Promise<RequirementFileWithRequirements | null> {
  const user = await requireSessionUser();
  const db = await createClient();

  const file = await getRequirementFile(db, requirementFileId);
  if (!file || file.user_id !== user.id) return null;
  return file;
}

// ---------------------------------------------------------------------------
// Guideline upload + extraction
// ---------------------------------------------------------------------------

export async function prepareGuidelineUpload(
  input: unknown,
): Promise<
  { ok: true; data: PreparedGuidelineUpload } | { ok: false; error: string }
> {
  const parsed = prepareGuidelineUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid file.",
    };
  }

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const requirementFileId = crypto.randomUUID();
    // Path is built from the SESSION user id, never client input — the storage
    // policy compares the first segment against auth.uid().
    const path = requirementStoragePath(
      user.id,
      requirementFileId,
      "guidelines.pdf",
    );
    const title =
      parsed.data.fileName.replace(/\.pdf$/i, "").trim() ||
      parsed.data.fileName;

    await createRequirementFile(db, {
      id: requirementFileId,
      userId: user.id,
      filePath: path,
      fileName: parsed.data.fileName,
      fileSizeBytes: parsed.data.fileSizeBytes,
      title,
    });

    const { data, error } = await db.storage
      .from(REQUIREMENTS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      return { ok: false, error: "Could not start the upload." };
    }

    return { ok: true, data: { requirementFileId, path, token: data.token } };
  } catch (error) {
    console.error("[requirements] prepareGuidelineUpload failed", error);
    return {
      ok: false,
      error: "Could not start the upload. Please try again.",
    };
  }
}

export async function finaliseGuidelineUpload(
  input: unknown,
): Promise<RequirementActionResult> {
  const parsed = finaliseGuidelineUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const file = await getRequirementFileMeta(
      db,
      parsed.data.requirementFileId,
    );
    if (!file || file.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await setRequirementFileStatus(
      admin,
      parsed.data.requirementFileId,
      "GENERATING",
    );
    // Small doc → run inline. Sets DONE / ERROR internally; never throws.
    await runGuidelineExtraction(admin, parsed.data.requirementFileId);

    revalidatePath("/requirements");
    revalidatePath(`/requirements/${parsed.data.requirementFileId}`);
    return { ok: true };
  } catch (error) {
    console.error("[requirements] finaliseGuidelineUpload failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function reextractRequirements(
  input: unknown,
): Promise<RequirementActionResult> {
  const parsed = reextractRequirementsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const file = await getRequirementFileMeta(
      db,
      parsed.data.requirementFileId,
    );
    if (!file || file.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await runGuidelineExtraction(admin, parsed.data.requirementFileId);

    revalidatePath("/requirements");
    revalidatePath(`/requirements/${parsed.data.requirementFileId}`);
    return { ok: true };
  } catch (error) {
    console.error("[requirements] reextractRequirements failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function deleteGuidelineFile(
  input: unknown,
): Promise<RequirementActionResult> {
  const parsed = deleteRequirementFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const file = await getRequirementFileMeta(
      db,
      parsed.data.requirementFileId,
    );
    if (!file || file.user_id !== user.id)
      return { ok: false, error: "not_found" };

    // Row delete cascades requirements; remove the stored file too (best-effort).
    await deleteRequirementFileRow(db, parsed.data.requirementFileId);
    const admin = createAdminClient();
    await admin.storage.from(REQUIREMENTS_BUCKET).remove([file.file_path]);

    revalidatePath("/requirements");
    return { ok: true };
  } catch (error) {
    console.error("[requirements] deleteGuidelineFile failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Requirement CRUD
// ---------------------------------------------------------------------------

const manualRequirementSchema = z.object({
  title: z.string().trim().min(1, "must not be empty").max(500),
  description: z.string().trim().max(5000).default(""),
  category: z.string().trim().max(200).nullable().default(null),
  isMandatory: z.boolean().default(true),
});

export async function createManualRequirement(
  input: unknown,
): Promise<RequirementActionResult> {
  const parsed = manualRequirementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const manualFile = await getOrCreateManualFile(db, user.id);
    await createRequirementRow(db, {
      requirementFileId: manualFile.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category
        ? normaliseCategory(parsed.data.category)
        : null,
      sourceQuote: null,
      isMandatory: parsed.data.isMandatory,
      sortOrder: 0,
    });

    revalidatePath("/requirements");
    return { ok: true };
  } catch (error) {
    console.error("[requirements] createManualRequirement failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function updateRequirement(
  input: unknown,
): Promise<RequirementActionResult> {
  const parsed = updateRequirementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const requirement = await getRequirement(db, parsed.data.requirementId);
    if (!requirement || requirement.user_id !== user.id)
      return { ok: false, error: "not_found" };

    await updateRequirementRow(db, parsed.data.requirementId, {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.category !== undefined
        ? {
            category: parsed.data.category
              ? normaliseCategory(parsed.data.category)
              : null,
          }
        : {}),
      ...(parsed.data.isMandatory !== undefined
        ? { is_mandatory: parsed.data.isMandatory }
        : {}),
      ...(parsed.data.isEnabled !== undefined
        ? { is_enabled: parsed.data.isEnabled }
        : {}),
      ...(parsed.data.sortOrder !== undefined
        ? { sort_order: parsed.data.sortOrder }
        : {}),
    });

    revalidatePath("/requirements");
    if (requirement.requirement_file_id)
      revalidatePath(`/requirements/${requirement.requirement_file_id}`);
    return { ok: true };
  } catch (error) {
    console.error("[requirements] updateRequirement failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function deleteRequirement(
  input: unknown,
): Promise<RequirementActionResult> {
  const parsed = deleteRequirementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const requirement = await getRequirement(db, parsed.data.requirementId);
    if (!requirement || requirement.user_id !== user.id)
      return { ok: false, error: "not_found" };

    await deleteRequirementRow(db, parsed.data.requirementId);

    revalidatePath("/requirements");
    if (requirement.requirement_file_id)
      revalidatePath(`/requirements/${requirement.requirement_file_id}`);
    return { ok: true };
  } catch (error) {
    console.error("[requirements] deleteRequirement failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Applying requirements to an upload
// ---------------------------------------------------------------------------

export async function attachRequirementsToUpload(
  input: unknown,
): Promise<RequirementActionResult> {
  const parsed = attachRequirementsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    // Both sides must belong to the caller. RLS scopes the requirements; the
    // upload is checked explicitly.
    await assertOwnsUpload(db, parsed.data.uploadId, user.id);

    const requirementIds = parsed.data.requirementIds.slice(
      0,
      MAX_ACTIVE_REQUIREMENTS,
    );

    await detachAllRequirements(db, parsed.data.uploadId);
    await attachRequirements(db, parsed.data.uploadId, requirementIds);
    await setUploadCustomRequirements(
      db,
      parsed.data.uploadId,
      requirementIds.length > 0,
    );

    return { ok: true };
  } catch (error) {
    console.error("[requirements] attachRequirementsToUpload failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Manual-file container
// ---------------------------------------------------------------------------

async function getOrCreateManualFile(
  db: Db,
  userId: string,
): Promise<RequirementFile> {
  const existing = await findManualRequirementFile(db, userId);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const file = await createRequirementFile(db, {
    id,
    userId,
    // A synthetic path (no stored object); its suffix marks it as the manual
    // container so the library labels these requirements "Manual".
    filePath: `${userId}${MANUAL_FILE_SUFFIX}`,
    fileName: "Manual",
    fileSizeBytes: 1,
    title: "Manual",
  });
  await setRequirementFileStatus(db, id, "DONE");
  return file;
}
