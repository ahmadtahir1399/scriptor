/**
 * Client-safe storage constants and path helpers.
 *
 * Deliberately free of any `server-only` / `next/headers` import so it can be
 * pulled into a Client Component (the upload hook needs the bucket name to
 * build the signed-upload URL) WITHOUT dragging the server Supabase client into
 * the browser bundle. The functions that actually touch storage live in
 * `./storage`, which is `server-only`; this file holds only the shared literals.
 */

export const PAPERS_BUCKET = "papers";

/** The private bucket for uploaded university/journal guideline documents. */
export const REQUIREMENTS_BUCKET = "requirements";

/** Signed URLs are deliberately short-lived. */
export const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Builds the canonical storage path.
 *
 * The first segment MUST be the owner's id — the storage RLS policy from P1
 * compares `storage.foldername(name)[1]` against `auth.uid()`, so any other
 * layout is unreadable even by its owner. `userId` must come from the server
 * session, never from client input.
 */
export function buildUploadPath(userId: string, uploadId: string): string {
  return `${userId}/${uploadId}/source.pdf`;
}
