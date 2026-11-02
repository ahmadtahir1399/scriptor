import { z } from "zod";

import {
  APP_LOCALES,
  CITATION_STYLES,
  SPELLING_VARIANTS,
} from "@/lib/db/enums";
import { uuidSchema } from "@/lib/validations/paper";

/** Upload flow input schemas. */

export const MAX_UPLOAD_BYTES = 52_428_800; // 50 MB — matches the bucket limit.
export const MAX_PAGES = 300;

/**
 * Sentinel for "I'm not sure — detect it".
 *
 * A distinct value rather than an empty string, so an unanswered select and a
 * deliberate "detect it" are distinguishable — the first is a validation
 * error, the second is a supported choice.
 */
export const CITATION_STYLE_AUTO = "AUTO" as const;

export const citationStyleChoiceSchema = z.union([
  z.enum(CITATION_STYLES),
  z.literal(CITATION_STYLE_AUTO),
]);
export type CitationStyleChoice = z.infer<typeof citationStyleChoiceSchema>;

export const uploadSettingsSchema = z
  .object({
    fileName: z.string().trim().min(1).max(500),
    fileSizeBytes: z
      .number()
      .int()
      .positive("file is empty")
      .max(MAX_UPLOAD_BYTES, "exceeds the 50 MB limit"),
    documentTypeCode: z.string().trim().min(1, "choose a document type"),
    locale: z.enum(APP_LOCALES),
    spelling: z.enum(SPELLING_VARIANTS),
    citationStyle: citationStyleChoiceSchema,
    checkIds: z.array(uuidSchema).min(1, "select at least one check"),
    autoDelete: z.boolean(),
    sendEmailResults: z.boolean(),
  })
  .refine(
    (value) =>
      value.locale === "DE"
        ? value.spelling === "DE_CH" || value.spelling === "DE_DE"
        : value.spelling === "EN_UK" || value.spelling === "EN_US",
    {
      message: "spelling variant does not match the selected language",
      path: ["spelling"],
    },
  );

export type UploadSettings = z.infer<typeof uploadSettingsSchema>;

export const finaliseUploadSchema = z.object({
  uploadId: uuidSchema,
});
export type FinaliseUploadInput = z.infer<typeof finaliseUploadSchema>;

export const retryIngestionSchema = z.object({
  uploadId: uuidSchema,
});
export type RetryIngestionInput = z.infer<typeof retryIngestionSchema>;

/**
 * Client-side file check.
 *
 * A hint only — the server re-validates the extension, the size and the magic
 * bytes regardless. This exists to give immediate feedback, not to enforce
 * anything.
 */
export function validateFileClientSide(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "notPdf";
  if (file.size > MAX_UPLOAD_BYTES) return "tooLarge";
  if (file.size === 0) return "empty";
  return null;
}
