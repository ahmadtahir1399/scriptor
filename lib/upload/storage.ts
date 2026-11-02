import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  PAPERS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  buildUploadPath,
} from "@/lib/upload/constants";

/**
 * Storage access for the private `papers` bucket.
 *
 * No public URL is generated anywhere. A thesis is unpublished work the
 * student has spent a year on; a permanent guessable URL to it would be a
 * serious breach, and Supabase makes that a one-line mistake.
 *
 * The shared literals (`PAPERS_BUCKET`, `SIGNED_URL_TTL_SECONDS`,
 * `buildUploadPath`) live in `./constants` so Client Components can use them
 * without importing this `server-only` module. Re-exported here so server-side
 * callers keep their single import point.
 */

export { PAPERS_BUCKET, SIGNED_URL_TTL_SECONDS, buildUploadPath };

/**
 * Creates a short-lived upload URL.
 *
 * The browser PUTs directly to storage rather than streaming through a server
 * action — a 50 MB body through a serverless function would hit both the
 * request size cap and the execution timeout.
 */
export async function createSignedUploadUrl(
  path: string,
): Promise<{ signedUrl: string; token: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(PAPERS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(
      `createSignedUploadUrl: ${error?.message ?? "no data returned"}`,
    );
  }

  return { signedUrl: data.signedUrl, token: data.token };
}

/** Short-lived read URL, generated server-side only. */
export async function createSignedReadUrl(path: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(PAPERS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    throw new Error(
      `createSignedReadUrl: ${error?.message ?? "no data returned"}`,
    );
  }

  return data.signedUrl;
}

/**
 * Downloads an upload's bytes for parsing.
 *
 * Uses the service-role client because this runs in the worker, which has no
 * user session to authorise a read against the owner's prefix.
 */
export async function downloadUploadBytes(path: string): Promise<Uint8Array> {
  const db = createAdminClient();

  const { data, error } = await db.storage.from(PAPERS_BUCKET).download(path);

  if (error || !data) {
    throw new Error(
      `downloadUploadBytes(${path}): ${error?.message ?? "not found"}`,
    );
  }

  return new Uint8Array(await data.arrayBuffer());
}

/** Removes an upload's file. Used when ingestion is abandoned. */
export async function deleteUploadFile(path: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.storage.from(PAPERS_BUCKET).remove([path]);

  if (error) {
    console.error(`[storage] failed to delete ${path}`, error.message);
  }
}
