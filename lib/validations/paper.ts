import { z } from "zod";

import {
  APP_LOCALES,
  CITATION_STYLES,
  FILE_FORMATS,
  SPELLING_VARIANTS,
} from "@/lib/db/enums";

/**
 * Server-action input schemas for the paper aggregate.
 *
 * Every enum below comes from `lib/db/enums.ts`. Retyping a string union here
 * would decouple validation from the database, and the two would drift the
 * first time an enum gains a value.
 */

export const uuidSchema = z.string().uuid("must be a valid id");

/** 50 MB — matches the `papers` storage bucket limit in migration 16. */
export const MAX_UPLOAD_BYTES = 52_428_800;

export const createPaperSchema = z.object({
  title: z
    .string()
    .trim()
    .max(500, "must be 500 characters or fewer")
    .default(""),
});
export type CreatePaperInput = z.infer<typeof createPaperSchema>;

export const updatePaperSchema = z.object({
  paperId: uuidSchema,
  title: z.string().trim().min(1, "must not be empty").max(500),
  isArchived: z.boolean().optional(),
});
export type UpdatePaperInput = z.infer<typeof updatePaperSchema>;

export const deletePaperSchema = z.object({
  paperId: uuidSchema,
});
export type DeletePaperInput = z.infer<typeof deletePaperSchema>;

/** Re-run the current version of a paper through the analysis engine. */
export const reanalysePaperSchema = z.object({
  paperId: uuidSchema,
});
export type ReanalysePaperInput = z.infer<typeof reanalysePaperSchema>;

/** Re-run the upload behind a specific analysis — the report-header entry point. */
export const reanalyseAnalysisSchema = z.object({
  analysisId: uuidSchema,
});
export type ReanalyseAnalysisInput = z.infer<typeof reanalyseAnalysisSchema>;

/** Re-queue the failed jobs of one analysis (a version whose run errored). */
export const retryAnalysisSchema = z.object({
  analysisId: uuidSchema,
});
export type RetryAnalysisInput = z.infer<typeof retryAnalysisSchema>;

/**
 * Registering an upload after the file has landed in storage.
 *
 * Extracted metadata is deliberately absent: it is written by the ingestion
 * worker with the service role, and the column grants in 15_rls.sql prevent a
 * client supplying it. Accepting it here would create a validated path to
 * values the database will reject anyway.
 */
export const createUploadSchema = z.object({
  paperId: uuidSchema,
  filePath: z.string().min(1, "must not be empty"),
  fileName: z.string().trim().min(1, "must not be empty").max(500),
  fileFormat: z.enum(FILE_FORMATS),
  fileSizeBytes: z
    .number()
    .int()
    .positive("must be greater than zero")
    .max(MAX_UPLOAD_BYTES, "exceeds the 50 MB limit"),
  checksumSha256: z.string().length(64).optional(),
  documentTypeCode: z.string().trim().min(1).max(64),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

/** The settings columns a user is actually granted UPDATE on. */
export const updateUploadSettingsSchema = z.object({
  uploadId: uuidSchema,
  autoDelete: z.boolean().optional(),
  shareData: z.boolean().optional(),
  sendEmailResults: z.boolean().optional(),
  selectedCheckIds: z.array(uuidSchema).max(100).optional(),
  useCustomRequirements: z.boolean().optional(),
});
export type UpdateUploadSettingsInput = z.infer<
  typeof updateUploadSettingsSchema
>;

/** Document properties the student declares before analysis starts. */
export const declareDocumentPropertiesSchema = z.object({
  uploadId: uuidSchema,
  locale: z.enum(APP_LOCALES),
  spelling: z.enum(SPELLING_VARIANTS),
  citationStyle: z.enum(CITATION_STYLES),
});
export type DeclareDocumentPropertiesInput = z.infer<
  typeof declareDocumentPropertiesSchema
>;

/**
 * Cross-check that the spelling variant belongs to the declared language.
 * DE with EN_US is a data-entry mistake that would send every check the wrong
 * orthographic rules, so it is rejected rather than silently corrected.
 */
export const documentPropertiesSchema = declareDocumentPropertiesSchema.refine(
  (value) =>
    value.locale === "DE"
      ? value.spelling === "DE_CH" || value.spelling === "DE_DE"
      : value.spelling === "EN_UK" || value.spelling === "EN_US",
  {
    message: "spelling variant does not match the declared language",
    path: ["spelling"],
  },
);

export const requestSignedUrlSchema = z.object({
  uploadId: uuidSchema,
  /** Signed URLs are short-lived by policy; 15 minutes is the ceiling. */
  expiresInSeconds: z.number().int().min(30).max(900).default(300),
});
export type RequestSignedUrlInput = z.infer<typeof requestSignedUrlSchema>;
