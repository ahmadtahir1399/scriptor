import { z } from "zod";

import { FILE_FORMATS } from "@/lib/db/enums";
import { uuidSchema } from "@/lib/validations/paper";

/** Server-action input schemas for the requirements aggregate. */

/** 10 MB — matches the `requirements` storage bucket limit in migration 16. */
export const MAX_REQUIREMENT_BYTES = 10_485_760;

export const createRequirementFileSchema = z.object({
  filePath: z.string().min(1, "must not be empty"),
  fileName: z.string().trim().min(1, "must not be empty").max(500),
  fileFormat: z.enum(FILE_FORMATS),
  fileSizeBytes: z
    .number()
    .int()
    .positive("must be greater than zero")
    .max(MAX_REQUIREMENT_BYTES, "exceeds the 10 MB limit"),
  title: z.string().trim().max(500).default(""),
  institutionId: uuidSchema.nullable().default(null),
});
export type CreateRequirementFileInput = z.infer<
  typeof createRequirementFileSchema
>;

export const updateRequirementFileSchema = z.object({
  requirementFileId: uuidSchema,
  title: z.string().trim().min(1, "must not be empty").max(500),
  institutionId: uuidSchema.nullable().optional(),
});
export type UpdateRequirementFileInput = z.infer<
  typeof updateRequirementFileSchema
>;

export const deleteRequirementFileSchema = z.object({
  requirementFileId: uuidSchema,
});
export type DeleteRequirementFileInput = z.infer<
  typeof deleteRequirementFileSchema
>;

export const createRequirementSchema = z.object({
  requirementFileId: uuidSchema,
  code: z.string().trim().max(64).nullable().default(null),
  title: z.string().trim().min(1, "must not be empty").max(500),
  description: z.string().trim().max(5000).default(""),
  category: z.string().trim().max(200).nullable().default(null),
  sourceQuote: z.string().trim().max(5000).nullable().default(null),
  isMandatory: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
});
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

export const updateRequirementSchema = z.object({
  requirementId: uuidSchema,
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().max(200).nullable().optional(),
  isMandatory: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

export const deleteRequirementSchema = z.object({
  requirementId: uuidSchema,
});
export type DeleteRequirementInput = z.infer<typeof deleteRequirementSchema>;

/** Attaching a set of requirements to an upload before analysis. */
export const attachRequirementsSchema = z.object({
  uploadId: uuidSchema,
  requirementIds: z.array(uuidSchema).max(500),
});
export type AttachRequirementsInput = z.infer<typeof attachRequirementsSchema>;

/**
 * Shape the extraction model must return.
 *
 * `source_quote` is required for the same reason `quote` is on a finding: a
 * requirement the student cannot trace back to a line in their faculty's guide
 * is one they have no reason to trust.
 */
export const llmRequirementSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().default(""),
  category: z.string().trim().max(200).nullable().default(null),
  source_quote: z
    .string()
    .min(1, "must not be empty")
    .refine((value) => value.trim().length > 0, "must not be only whitespace"),
  is_mandatory: z.boolean().default(true),
});
export type LlmRequirement = z.infer<typeof llmRequirementSchema>;

export const llmRequirementsResponseSchema = z.object({
  requirements: z.array(llmRequirementSchema).default([]),
});
export type LlmRequirementsResponse = z.infer<
  typeof llmRequirementsResponseSchema
>;

/**
 * Reserving a guideline-file upload before the bytes land in storage.
 *
 * Mirrors P2's `uploadSettings`: only the file's own facts, never extracted
 * content — the worker fills the rest. `fileFormat` is fixed to PDF here (the
 * only format the parser handles); the server still magic-byte-checks the bytes.
 */
export const prepareGuidelineUploadSchema = z.object({
  fileName: z.string().trim().min(1, "must not be empty").max(500),
  fileSizeBytes: z
    .number()
    .int()
    .positive("file is empty")
    .max(MAX_REQUIREMENT_BYTES, "exceeds the 10 MB limit"),
});
export type PrepareGuidelineUploadInput = z.infer<
  typeof prepareGuidelineUploadSchema
>;

export const finaliseGuidelineUploadSchema = z.object({
  requirementFileId: uuidSchema,
});
export type FinaliseGuidelineUploadInput = z.infer<
  typeof finaliseGuidelineUploadSchema
>;

export const reextractRequirementsSchema = z.object({
  requirementFileId: uuidSchema,
});
export type ReextractRequirementsInput = z.infer<
  typeof reextractRequirementsSchema
>;

/**
 * The verdict shape a requirement-check must return.
 *
 * A requirement grades to satisfied / not, WITH the evidence for the verdict —
 * `evidence_quote` is the requirement analogue of a finding's quote: a verdict
 * the student cannot trace to a line in their own thesis is one they cannot act
 * on. `page_number` locates it where the model can attribute one.
 */
export const requirementVerdictSchema = z.object({
  satisfied: z.boolean(),
  evidence_quote: z.string().trim().max(2000).nullable().default(null),
  explanation: z.string().trim().max(2000).default(""),
  page_number: z.number().int().positive().nullable().default(null),
});
export type RequirementVerdict = z.infer<typeof requirementVerdictSchema>;
