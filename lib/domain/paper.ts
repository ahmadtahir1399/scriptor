import type { Tables } from "@/lib/db/types.generated";

/**
 * Paper aggregate.
 *
 * Later prompts import these composed types rather than reaching into the
 * generated file, so a schema change surfaces in one place per aggregate
 * instead of in every component that happened to select a join.
 */

export type Paper = Tables<"papers">;
export type PaperUpload = Tables<"paper_uploads">;
export type UploadEntitlement = Tables<"upload_entitlements">;
export type PaperPage = Tables<"paper_pages">;
export type Word = Tables<"words">;
export type DocumentType = Tables<"document_types">;

/** An upload with the entitlements decided for it at upload time. */
export interface UploadWithEntitlements extends PaperUpload {
  upload_entitlements: UploadEntitlement | null;
}

/** A paper together with its current draft — the shape the papers list renders. */
export interface PaperWithCurrentUpload extends Paper {
  current_upload: PaperUpload | null;
}

/** Everything the upload detail screen needs in one round trip. */
export interface PaperWithUploads extends Paper {
  paper_uploads: PaperUpload[];
  current_upload: PaperUpload | null;
}

/** A page with its words, used by the P7 viewer one page at a time. */
export interface PaperPageWithWords extends PaperPage {
  words: Word[];
}

/**
 * The compatibility verdict.
 *
 * `is_compatible` is nullable in the database because null means "not yet
 * evaluated", which is genuinely different from "evaluated and rejected". This
 * discriminated union makes the caller handle all three rather than treating a
 * falsy value as a rejection.
 */
export type CompatibilityVerdict =
  | { state: "pending" }
  | { state: "compatible" }
  | { state: "incompatible"; reason: string };

export function readCompatibility(upload: PaperUpload): CompatibilityVerdict {
  if (upload.is_compatible === null) {
    return { state: "pending" };
  }
  if (upload.is_compatible) {
    return { state: "compatible" };
  }
  return {
    state: "incompatible",
    reason: upload.incompatibility_reason ?? "",
  };
}

/**
 * Storage path for an uploaded thesis.
 *
 * The first segment must be the owner's id — the storage RLS policy compares
 * `storage.foldername(name)[1]` to `auth.uid()`, so any other layout is
 * unreadable even by its own owner.
 */
export function paperStoragePath(
  userId: string,
  paperUploadId: string,
  extension: "pdf" | "docx",
): string {
  return `${userId}/${paperUploadId}/source.${extension}`;
}
