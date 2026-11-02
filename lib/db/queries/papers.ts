import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types.generated";
import type {
  Paper,
  PaperPage,
  PaperUpload,
  PaperWithCurrentUpload,
  UploadWithEntitlements,
  Word,
} from "@/lib/domain/paper";

/**
 * Paper aggregate reads.
 *
 * Every table read in the app goes through a named function in `lib/db/queries`.
 * No component and no later prompt writes an inline `.from(...).select(...)` —
 * that is what keeps sixteen prompts from each inventing a slightly different
 * select list and then diverging when a column is added.
 *
 * All functions take the client as their first argument so the same helper
 * serves a server component, a server action and the ingestion worker without
 * knowing which one is calling.
 */

export type Db = SupabaseClient<Database>;

/** Unwraps a Supabase result, turning an error into a thrown exception. */
function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

const UPLOAD_COLUMNS =
  "id, paper_id, user_id, file_path, file_name, file_format, file_size_bytes, " +
  "checksum_sha256, title, author, page_count, word_count, char_count, locale, " +
  "spelling, citation_style, document_type_code, is_compatible, " +
  "incompatibility_reason, auto_delete, share_data, send_email_results, " +
  "selected_check_ids, use_custom_requirements, uploaded_at, parsed_at, " +
  "created_at, updated_at";

/** The papers list. RLS restricts this to the caller's own rows. */
export async function listPapers(db: Db): Promise<PaperWithCurrentUpload[]> {
  const result = await db
    .from("papers")
    .select(
      `*, current_upload:paper_uploads!papers_current_upload_id_fkey(${UPLOAD_COLUMNS})`,
    )
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  return unwrap(result, "listPapers") as unknown as PaperWithCurrentUpload[];
}

export async function getPaper(db: Db, paperId: string): Promise<Paper | null> {
  const result = await db
    .from("papers")
    .select("*")
    .eq("id", paperId)
    .maybeSingle();
  return unwrap(result, "getPaper");
}

/** Every draft of one paper, newest first. */
export async function listUploadsForPaper(
  db: Db,
  paperId: string,
): Promise<PaperUpload[]> {
  const result = await db
    .from("paper_uploads")
    .select(UPLOAD_COLUMNS)
    .eq("paper_id", paperId)
    .order("created_at", { ascending: false });

  return unwrap(result, "listUploadsForPaper") as unknown as PaperUpload[];
}

export async function getUpload(
  db: Db,
  uploadId: string,
): Promise<PaperUpload | null> {
  const result = await db
    .from("paper_uploads")
    .select(UPLOAD_COLUMNS)
    .eq("id", uploadId)
    .maybeSingle();

  return unwrap(result, "getUpload") as unknown as PaperUpload | null;
}

/** An upload plus the entitlements frozen at upload time. */
export async function getUploadWithEntitlements(
  db: Db,
  uploadId: string,
): Promise<UploadWithEntitlements | null> {
  const result = await db
    .from("paper_uploads")
    .select(`${UPLOAD_COLUMNS}, upload_entitlements(*)`)
    .eq("id", uploadId)
    .maybeSingle();

  return unwrap(
    result,
    "getUploadWithEntitlements",
  ) as unknown as UploadWithEntitlements | null;
}

/**
 * Pages of one upload, optionally filtered by type.
 *
 * The type filter is the mechanism that keeps analysis affordable: a check
 * scoped to BODY never loads the cover page or the bibliography.
 */
export async function listPages(
  db: Db,
  uploadId: string,
  pageTypes?: readonly Database["public"]["Enums"]["page_type"][],
): Promise<PaperPage[]> {
  let query = db
    .from("paper_pages")
    .select("*")
    .eq("paper_upload_id", uploadId)
    .order("page_number", { ascending: true });

  if (pageTypes && pageTypes.length > 0) {
    query = query.in("page_type", [...pageTypes]);
  }

  return unwrap(await query, "listPages");
}

/**
 * Words for ONE page.
 *
 * Deliberately page-scoped and with no whole-upload variant. A thesis holds
 * roughly 50,000 word rows; fetching them all would blow past the API's row
 * cap and stall the viewer. P7 renders one page at a time and this matches.
 */
export async function listWordsForPage(
  db: Db,
  uploadId: string,
  pageNumber: number,
): Promise<Word[]> {
  const result = await db
    .from("words")
    .select("*")
    .eq("paper_upload_id", uploadId)
    .eq("page_number", pageNumber)
    .order("word_index", { ascending: true });

  return unwrap(result, "listWordsForPage");
}

/**
 * Words covering an index range — how a finding becomes a highlight box.
 * Uses the (paper_upload_id, word_index) index created in migration 06.
 */
export async function listWordsInRange(
  db: Db,
  uploadId: string,
  startIndex: number,
  endIndex: number,
): Promise<Word[]> {
  const result = await db
    .from("words")
    .select("*")
    .eq("paper_upload_id", uploadId)
    .gte("word_index", startIndex)
    .lte("word_index", endIndex)
    .order("word_index", { ascending: true });

  return unwrap(result, "listWordsInRange");
}

/**
 * Words for a specific set of pages — the viewer's highlight source.
 *
 * The viewer only needs geometry for pages that actually carry a finding, so it
 * passes exactly those page numbers rather than pulling all ~50,000 word rows.
 * An empty page list short-circuits to no query.
 */
export async function listWordsForPages(
  db: Db,
  uploadId: string,
  pageNumbers: readonly number[],
): Promise<Word[]> {
  if (pageNumbers.length === 0) return [];

  const result = await db
    .from("words")
    .select("*")
    .eq("paper_upload_id", uploadId)
    .in("page_number", [...pageNumbers])
    .order("word_index", { ascending: true });

  return unwrap(result, "listWordsForPages");
}

/**
 * Whether inline highlights are possible for an upload.
 *
 * True only for a parsed PDF with word geometry. A DOCX, or a PDF whose parse
 * produced no words, has no boxes to highlight — the viewer then degrades to
 * the findings-only fallback rather than showing a broken canvas. A head-only
 * count keeps this cheap.
 */
export async function hasWordGeometry(
  db: Db,
  uploadId: string,
): Promise<boolean> {
  const result = await db
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("paper_upload_id", uploadId)
    .limit(1);

  if (result.error) {
    throw new Error(`hasWordGeometry: ${result.error.message}`);
  }
  return (result.count ?? 0) > 0;
}

export async function listDocumentTypes(
  db: Db,
): Promise<Database["public"]["Tables"]["document_types"]["Row"][]> {
  const result = await db
    .from("document_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return unwrap(result, "listDocumentTypes");
}

// ===========================================================================
// P8 — Papers library & version reads.
// ===========================================================================

/**
 * Flat list of the caller's analyses — the raw material for the library.
 *
 * RLS scopes it to the user. Deliberately thin (no results, no findings): the
 * library only needs each analysis's score, status and which upload it belongs
 * to, and the version model is assembled from these in `lib/papers/presentation`
 * without a second query per paper. Ordered oldest-first so version numbering is
 * a straight index.
 */
export interface UserAnalysisRow {
  id: string;
  paper_id: string;
  paper_upload_id: string;
  status: Database["public"]["Enums"]["analysis_status"];
  overall_score: number | null;
  created_at: string;
}

export async function listAnalysesForUser(db: Db): Promise<UserAnalysisRow[]> {
  const result = await db
    .from("paper_analyses")
    .select("id, paper_id, paper_upload_id, status, overall_score, created_at")
    .order("created_at", { ascending: true });

  return unwrap(result, "listAnalysesForUser");
}

/**
 * Count of unresolved findings for one analysis — the "12 open issues" chip.
 *
 * A head-only exact count, so it never pulls finding rows. Called once per
 * paper's CURRENT analysis, never per version, to keep the library cheap.
 */
export async function countOpenFindings(
  db: Db,
  analysisId: string,
): Promise<number> {
  const result = await db
    .from("findings")
    .select("*", { count: "exact", head: true })
    .eq("paper_analysis_id", analysisId)
    .eq("is_resolved", false);

  if (result.error) {
    throw new Error(`countOpenFindings: ${result.error.message}`);
  }
  return result.count ?? 0;
}
