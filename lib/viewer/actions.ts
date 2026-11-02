"use server";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAnalysis } from "@/lib/db/queries/analyses";
import { getUpload } from "@/lib/db/queries/papers";
import { getFinding, setFindingResolved } from "@/lib/db/queries/findings";
import { createSignedReadUrl } from "@/lib/upload/storage";
import {
  documentUrlSchema,
  resolveFindingSchema,
} from "@/lib/validations/finding";

/**
 * Viewer server actions.
 *
 * The PDF is served through a SHORT-LIVED SIGNED URL minted here after an
 * RLS-scoped ownership check — the client receives a 60-second URL and never
 * the storage key or the service role. No document bytes or word geometry pass
 * through any third party: the URL points straight at Supabase Storage and the
 * render happens entirely in the browser.
 */

export type DocumentUrlResult =
  { ok: true; url: string } | { ok: false; error: "not_found" | "unavailable" };

export async function requestDocumentUrl(
  input: unknown,
): Promise<DocumentUrlResult> {
  const parsed = documentUrlSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "not_found" };
  }

  try {
    await requireSessionUser();
    const db = await createClient();

    // RLS scopes this: another user's analysis reads back as null → not_found,
    // never a leak that the id exists.
    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis) {
      return { ok: false, error: "not_found" };
    }

    const upload = await getUpload(db, analysis.paper_upload_id);
    if (!upload) {
      return { ok: false, error: "not_found" };
    }

    // Minted with the user session, so the storage policy (own-prefix only)
    // applies; 60s TTL comes from storage.ts.
    const url = await createSignedReadUrl(upload.file_path);
    return { ok: true, url };
  } catch (error) {
    console.error("[viewer] requestDocumentUrl failed", error);
    return { ok: false, error: "unavailable" };
  }
}

export type ResolveResult = { ok: true } | { ok: false; error: string };

/**
 * Resolves or un-resolves a finding.
 *
 * The single write path shared with P5 and P12: `setFindingResolved` under the
 * user session, so RLS + the column grant (`is_resolved`, `resolved_at` only)
 * enforce that a student can never resolve someone else's finding. Ownership is
 * re-checked explicitly first for a clear result.
 */
export async function resolveFinding(input: unknown): Promise<ResolveResult> {
  const parsed = resolveFindingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const finding = await getFinding(db, parsed.data.findingId);
    if (!finding || finding.user_id !== user.id) {
      return { ok: false, error: "Not found." };
    }

    await setFindingResolved(db, parsed.data.findingId, parsed.data.isResolved);
    return { ok: true };
  } catch (error) {
    console.error("[viewer] resolveFinding failed", error);
    return { ok: false, error: "Could not update the finding." };
  }
}
