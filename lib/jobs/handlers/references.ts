import "server-only";

import type { Db } from "@/lib/db/queries/papers";
import { listPages, listWordsForPage } from "@/lib/db/queries/papers";
import {
  insertInTextReferences,
  writeReferencePairs,
} from "@/lib/db/queries/references";
import {
  extractInTextCitations,
  type PageWords,
} from "@/lib/references/extractInText";
import {
  reconcile,
  type BibItem,
  type InTextItem,
} from "@/lib/references/reconcile";
import { mapLimit } from "@/lib/references/providers/index";
import { findBibliographyWordCutoff } from "@/lib/references/referenceSections";

/**
 * Stage 2 — in-text extraction and reconciliation.
 *
 * This is the module the BIBLIOGRAPHY job calls after it has parsed the
 * reference list. It is NOT a registered job kind: `job_kind` ships with
 * BIBLIOGRAPHY and REFERENCE_HEALTH only, and the in-text/reconcile step is a
 * deterministic continuation of the bibliography job rather than a third queued
 * unit. (`REFERENCE` exists as an `llm_operation`, not a job kind — and this
 * stage uses no model at all.)
 *
 * Words are loaded ONE PAGE AT A TIME: a thesis holds ~50,000 word rows, well
 * past PostgREST's row cap, so a single whole-document fetch would silently
 * truncate. Per-page reads stay under the cap; a small concurrency limit keeps
 * the round trips from serialising.
 */

export interface ReconcileBibItem {
  id: string;
  authors: string[];
  year: string | null;
  entryIndex: number;
}

export interface ReconcileOutcome {
  inTextCount: number;
  citedButMissing: number;
  listedButUncited: number;
}

const WORD_READ_CONCURRENCY = 5;

export async function runReferenceReconciliation(
  db: Db,
  args: {
    analysisId: string;
    uploadId: string;
    bibItems: readonly ReconcileBibItem[];
    /**
     * First page of the reference list. Body text at and beyond this point is
     * the reference list itself, and reading citations out of it invents them.
     */
    referenceStartPage: number | null;
  },
): Promise<ReconcileOutcome> {
  const { referenceStartPage } = args;
  const allPages = await listPages(db, args.uploadId);

  /*
   * Which pages can hold a citation.
   *
   * Below the reference list, prose only. AT the page where the list starts,
   * the page is included WHATEVER its type — a page that is half conclusion and
   * half reference list is frequently classified BIBLIOGRAPHY on the strength
   * of its second half, and filtering on type alone would throw away the
   * conclusion's citations with it. The word cutoff below is what separates the
   * two halves. Past that page there is no prose left to cite anything.
   */
  const bodyPages = allPages.filter((page) => {
    if (referenceStartPage === null) return page.page_type === "BODY";
    if (page.page_number === referenceStartPage) return true;
    return page.page_number < referenceStartPage && page.page_type === "BODY";
  });

  // Load each page's words under the row cap, bounded concurrency.
  const pageWords: PageWords[] = await mapLimit(
    bodyPages,
    WORD_READ_CONCURRENCY,
    async (page) => {
      const words = await listWordsForPage(db, args.uploadId, page.page_number);
      const mapped = words.map((word) => ({
        text: word.text,
        wordIndex: word.word_index,
      }));

      // On the page where the list starts, keep only the prose above it.
      const cutoff =
        page.page_number === referenceStartPage
          ? findBibliographyWordCutoff(mapped)
          : null;

      return {
        pageNumber: page.page_number,
        words: cutoff === null ? mapped : mapped.slice(0, cutoff),
      };
    },
  );

  const citations = extractInTextCitations(pageWords);

  // Persist the citations, then correlate the returned ids by position.
  const inserted = await insertInTextReferences(
    db,
    args.analysisId,
    args.uploadId,
    citations.map((citation) => ({
      rawText: citation.rawText,
      authors: citation.authors,
      year: citation.year,
      locator:
        citation.numericIndex !== null ? String(citation.numericIndex) : null,
      pageNumber: citation.pageNumber,
      wordIndexStart: citation.wordIndexStart,
      wordIndexEnd: citation.wordIndexEnd,
    })),
  );

  const inTextItems: InTextItem[] = citations.map((citation, index) => ({
    id: inserted[index]?.id ?? "",
    authors: citation.authors,
    year: citation.year,
    numericIndex: citation.numericIndex,
    family: citation.family,
  }));

  const bibItems: BibItem[] = args.bibItems.map((item) => ({
    id: item.id,
    authors: item.authors,
    year: item.year,
    entryIndex: item.entryIndex,
  }));

  const pairs = reconcile(inTextItems, bibItems);
  await writeReferencePairs(db, args.analysisId, pairs);

  return {
    inTextCount: citations.length,
    citedButMissing: pairs.filter((p) => p.kind === "cited_but_missing").length,
    listedButUncited: pairs.filter((p) => p.kind === "listed_but_uncited")
      .length,
  };
}
