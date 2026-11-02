import "server-only";

import type { PageType } from "@/lib/db/enums";
import type { TablesInsert } from "@/lib/db/types.generated";
import type { Db } from "@/lib/db/queries/papers";

/**
 * Ingestion writes. SERVICE ROLE ONLY.
 *
 * `paper_pages` and `words` are select-only for users under P1's RLS, so every
 * function here needs the admin client. Follows the same rule as the rest of
 * `lib/db/queries`: no inline `.from()` anywhere outside this directory.
 */

/** words is inserted in chunks — a 150-page thesis is ~50,000 rows. */
export const WORD_INSERT_CHUNK = 1_000;

export interface PageInsert {
  pageNumber: number;
  text: string;
  pageType: PageType;
  charOffsetStart: number;
  charOffsetEnd: number;
  wordCount: number;
  pageWidth: number;
  pageHeight: number;
}

export interface WordInsert {
  text: string;
  pageNumber: number;
  wordIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

/**
 * Removes prior parse output for an upload.
 *
 * Every handler is idempotent, and this is how PARSE achieves it: a retry must
 * produce the same end state, not a second copy of 50,000 word rows. Called
 * before writing, never as a standalone cleanup.
 */
export async function clearParsedDocument(
  db: Db,
  uploadId: string,
): Promise<void> {
  const words = await db.from("words").delete().eq("paper_upload_id", uploadId);
  if (words.error) {
    throw new Error(`clearParsedDocument(words): ${words.error.message}`);
  }

  const pages = await db
    .from("paper_pages")
    .delete()
    .eq("paper_upload_id", uploadId);
  if (pages.error) {
    throw new Error(`clearParsedDocument(pages): ${pages.error.message}`);
  }
}

export async function insertPages(
  db: Db,
  uploadId: string,
  pages: readonly PageInsert[],
): Promise<void> {
  if (pages.length === 0) return;

  const rows: TablesInsert<"paper_pages">[] = pages.map((page) => ({
    paper_upload_id: uploadId,
    page_number: page.pageNumber,
    page_content: page.text,
    page_type: page.pageType,
    char_offset_start: page.charOffsetStart,
    char_offset_end: page.charOffsetEnd,
    word_count: page.wordCount,
    page_width: page.pageWidth,
    page_height: page.pageHeight,
  }));

  const result = await db.from("paper_pages").insert(rows);
  if (result.error) {
    throw new Error(`insertPages: ${result.error.message}`);
  }
}

/**
 * Bulk-inserts words in chunks.
 *
 * A single insert of ~50,000 rows exceeds the statement timeout and fails the
 * whole parse. Chunking also bounds peak memory — the full row array is built
 * lazily per chunk rather than all at once.
 */
export async function insertWords(
  db: Db,
  uploadId: string,
  words: readonly WordInsert[],
): Promise<number> {
  let inserted = 0;

  for (let offset = 0; offset < words.length; offset += WORD_INSERT_CHUNK) {
    const chunk = words.slice(offset, offset + WORD_INSERT_CHUNK);

    const rows: TablesInsert<"words">[] = chunk.map((word) => ({
      paper_upload_id: uploadId,
      text: word.text,
      page_number: word.pageNumber,
      word_index: word.wordIndex,
      x1: word.x1,
      y1: word.y1,
      x2: word.x2,
      y2: word.y2,
      width: word.width,
      height: word.height,
    }));

    const result = await db.from("words").insert(rows);
    if (result.error) {
      throw new Error(
        `insertWords (chunk at ${offset}): ${result.error.message}`,
      );
    }

    inserted += chunk.length;
  }

  return inserted;
}

/** Updates page classifications after IDENTIFY_PAGES. */
export async function updatePageTypes(
  db: Db,
  uploadId: string,
  classifications: ReadonlyArray<{ pageNumber: number; pageType: PageType }>,
): Promise<void> {
  for (const item of classifications) {
    const result = await db
      .from("paper_pages")
      .update({ page_type: item.pageType })
      .eq("paper_upload_id", uploadId)
      .eq("page_number", item.pageNumber);

    if (result.error) {
      throw new Error(`updatePageTypes: ${result.error.message}`);
    }
  }
}

/** Writes extracted metadata and the parse timestamp onto the upload. */
export async function markUploadParsed(
  db: Db,
  uploadId: string,
  metadata: {
    pageCount: number;
    wordCount: number;
    charCount: number;
  },
): Promise<void> {
  const result = await db
    .from("paper_uploads")
    .update({
      page_count: metadata.pageCount,
      word_count: metadata.wordCount,
      char_count: metadata.charCount,
      parsed_at: new Date().toISOString(),
    })
    .eq("id", uploadId);

  if (result.error) {
    throw new Error(`markUploadParsed: ${result.error.message}`);
  }
}

/** Records the compatibility verdict. */
export async function setCompatibility(
  db: Db,
  uploadId: string,
  compatible: boolean,
  reason: string | null,
): Promise<void> {
  const result = await db
    .from("paper_uploads")
    .update({ is_compatible: compatible, incompatibility_reason: reason })
    .eq("id", uploadId);

  if (result.error) {
    throw new Error(`setCompatibility: ${result.error.message}`);
  }
}

/** Page types present on an upload, for the compatibility gate. */
export async function listPageTypes(
  db: Db,
  uploadId: string,
): Promise<PageType[]> {
  const result = await db
    .from("paper_pages")
    .select("page_type")
    .eq("paper_upload_id", uploadId);

  if (result.error) {
    throw new Error(`listPageTypes: ${result.error.message}`);
  }

  return (result.data ?? []).map((row) => row.page_type);
}

/** Ingestion funnel telemetry. Never throws — losing an event is not fatal. */
export async function logUploadEvent(
  db: Db,
  uploadId: string,
  eventType: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.from("upload_events").insert({
      paper_upload_id: uploadId,
      event_type: eventType,
      detail: detail as never,
    });
  } catch (error) {
    console.error("[uploadEvents] failed to log", { eventType, error });
  }
}
