import { surnameOf } from "@/lib/references/matchTitle";
import type { CitationFamily } from "@/lib/validations/reference";

/**
 * Reconciliation — pairing in-text citations to bibliography entries.
 *
 * PURE and DETERMINISTIC. No model, no network, no clock. Once the strings are
 * parsed, matching a citation to its reference-list entry is arithmetic:
 * surname + year for author-date, index for numeric. The ORPHANS that fall out
 * of the join are the entire product value — a citation with no entry
 * (cited-but-missing) is a real problem; an entry no citation points at
 * (listed-but-uncited) is a softer flag. Both are found here, and only here.
 *
 * Unit tested in `__tests__/reconcile.test.ts`.
 */

export interface InTextItem {
  id: string;
  authors: readonly string[];
  year: string | null;
  /** Numeric citation number, e.g. "[12]" → 12. Null for author-date. */
  numericIndex: number | null;
  family: CitationFamily;
}

export interface BibItem {
  id: string;
  authors: readonly string[];
  year: string | null;
  /** 0-based position in the reference list; numeric citations map to index+1. */
  entryIndex: number | null;
}

export type PairResult =
  | { kind: "matched"; inTextId: string; bibId: string; confidence: number }
  | { kind: "cited_but_missing"; inTextId: string }
  | { kind: "listed_but_uncited"; bibId: string };

const MIN_AUTHOR_DATE_CONFIDENCE = 0.6;

/**
 * Reconciles the two lists.
 *
 * Every in-text citation becomes exactly one pair: matched to its entry, or an
 * orphan (cited-but-missing). Every bibliography entry that no citation matched
 * becomes a listed-but-uncited orphan. A matched entry is represented through
 * its citations, so it never doubles as an uncited orphan.
 */
export function reconcile(
  inText: readonly InTextItem[],
  bibliography: readonly BibItem[],
): PairResult[] {
  const pairs: PairResult[] = [];
  const matchedBibIds = new Set<string>();

  // Numeric lookup: reference number N → the entry at position N-1.
  const byNumber = new Map<number, BibItem>();
  for (const entry of bibliography) {
    if (entry.entryIndex !== null) byNumber.set(entry.entryIndex + 1, entry);
  }

  for (const citation of inText) {
    const match =
      citation.family === "numeric"
        ? matchNumeric(citation, byNumber)
        : matchAuthorDate(citation, bibliography);

    if (match) {
      pairs.push({
        kind: "matched",
        inTextId: citation.id,
        bibId: match.bibId,
        confidence: match.confidence,
      });
      matchedBibIds.add(match.bibId);
    } else {
      pairs.push({ kind: "cited_but_missing", inTextId: citation.id });
    }
  }

  for (const entry of bibliography) {
    if (!matchedBibIds.has(entry.id)) {
      pairs.push({ kind: "listed_but_uncited", bibId: entry.id });
    }
  }

  return pairs;
}

function matchNumeric(
  citation: InTextItem,
  byNumber: ReadonlyMap<number, BibItem>,
): { bibId: string; confidence: number } | null {
  if (citation.numericIndex === null) return null;
  const entry = byNumber.get(citation.numericIndex);
  return entry ? { bibId: entry.id, confidence: 0.95 } : null;
}

function matchAuthorDate(
  citation: InTextItem,
  bibliography: readonly BibItem[],
): { bibId: string; confidence: number } | null {
  let best: { bibId: string; confidence: number } | null = null;

  for (const entry of bibliography) {
    const confidence = authorDateConfidence(citation, entry);
    if (
      confidence >= MIN_AUTHOR_DATE_CONFIDENCE &&
      (!best || confidence > best.confidence)
    ) {
      best = { bibId: entry.id, confidence };
    }
  }

  return best;
}

/**
 * Confidence that an author-date citation refers to a given entry.
 *
 * Requires a shared surname (author-date citations are identified by author).
 * A matching year lifts confidence to certainty; a CONFLICTING year (both
 * present, different) rejects the match outright — that is two different works
 * by the same author, the exact thing author-date disambiguation exists for.
 */
export function authorDateConfidence(
  citation: InTextItem,
  entry: BibItem,
): number {
  const citationSurnames = new Set(
    citation.authors.map(surnameOf).filter((s) => s.length > 1),
  );
  const entrySurnames = entry.authors
    .map(surnameOf)
    .filter((s) => s.length > 1);
  const sharesSurname = entrySurnames.some((surname) =>
    citationSurnames.has(surname),
  );
  if (!sharesSurname) return 0;

  const bothYears = citation.year !== null && entry.year !== null;
  if (bothYears) {
    return normaliseYear(citation.year) === normaliseYear(entry.year) ? 1 : 0;
  }

  // Surname agrees, year unknown on one side — a plausible but weaker match.
  return 0.6;
}

/** Strips a disambiguating letter suffix: "2017a" and "2017" are the same year. */
function normaliseYear(year: string | null): string {
  return (year ?? "").trim().replace(/[a-z]$/i, "");
}
