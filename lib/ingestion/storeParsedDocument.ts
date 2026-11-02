import "server-only";

import type { PageType } from "@/lib/db/enums";
import {
  clearParsedDocument,
  insertPages,
  insertWords,
  markUploadParsed,
  type PageInsert,
  type WordInsert,
} from "@/lib/db/queries/ingestion";
import type { Db } from "@/lib/db/queries/papers";
import type { ParsedDocument } from "@/lib/ingestion/parsePdf";

/**
 * Persists a parsed document.
 *
 * Idempotent: clears prior output for the upload before writing, so a retried
 * PARSE job produces the same end state rather than a duplicate set of rows.
 */
export interface StoreResult {
  pagesWritten: number;
  wordsWritten: number;
  totalChars: number;
}

export async function storeParsedDocument(
  db: Db,
  uploadId: string,
  parsed: ParsedDocument,
): Promise<StoreResult> {
  await clearParsedDocument(db, uploadId);

  const pages: PageInsert[] = [];
  const words: WordInsert[] = [];

  /*
   * Two running counters, both document-global:
   *
   *   charCursor — start offset of each page within the concatenated document
   *                text. Later model output reports character positions, and
   *                these offsets resolve one to a page without re-scanning.
   *   wordIndex  — the ordinal a finding's word_index_start/end references.
   *
   * Both must be assigned in page order, which is why this is a single pass
   * rather than two independent maps.
   */
  let charCursor = 0;
  let wordIndex = 0;

  for (const page of parsed.pages) {
    const charOffsetStart = charCursor;
    const charOffsetEnd = charOffsetStart + page.text.length;

    pages.push({
      pageNumber: page.pageNumber,
      text: page.text,
      // PARSE does not classify; IDENTIFY_PAGES overwrites this next.
      pageType: "OTHER" satisfies PageType,
      charOffsetStart,
      charOffsetEnd,
      wordCount: page.words.length,
      pageWidth: page.pageWidth,
      pageHeight: page.pageHeight,
    });

    for (const word of page.words) {
      words.push({
        text: word.text,
        pageNumber: page.pageNumber,
        wordIndex,
        x1: word.x1,
        y1: word.y1,
        x2: word.x2,
        y2: word.y2,
        width: word.width,
        height: word.height,
      });
      wordIndex += 1;
    }

    // +1 for the newline joining pages in the concatenated document text.
    charCursor = charOffsetEnd + 1;
  }

  await insertPages(db, uploadId, pages);
  const wordsWritten = await insertWords(db, uploadId, words);

  await markUploadParsed(db, uploadId, {
    pageCount: parsed.pageCount,
    wordCount: parsed.totalWords,
    charCount: parsed.totalChars,
  });

  return {
    pagesWritten: pages.length,
    wordsWritten,
    totalChars: parsed.totalChars,
  };
}
