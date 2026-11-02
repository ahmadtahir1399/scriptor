import type { PageType } from "@/lib/db/enums";

/**
 * Rule-based page classification.
 *
 * Runs before any model call and resolves the large majority of pages at zero
 * cost. A 200-page thesis has maybe three genuinely ambiguous pages; sending
 * all 200 to a model would be both slower and pointless.
 *
 * Pure functions over text — no I/O, no dependencies, fully unit-testable.
 * Bilingual by design: the product serves German and English theses, and a
 * German document whose bibliography is missed would have its citation check
 * run over its reference list.
 */

const HEADING_SCAN_CHARS = 300;

/** Heading patterns, anchored so a passing mention in prose does not match. */
const HEADING_PATTERNS: ReadonlyArray<{ type: PageType; pattern: RegExp }> = [
  {
    type: "TOC",
    pattern:
      /^\s*(table\s+of\s+contents|contents|inhaltsverzeichnis|inhalt)\b/i,
  },
  {
    type: "ABSTRACT",
    pattern: /^\s*(abstract|zusammenfassung|kurzfassung|summary)\b/i,
  },
  {
    type: "BIBLIOGRAPHY",
    pattern:
      /^\s*(references|bibliography|works\s+cited|literaturverzeichnis|quellenverzeichnis|literatur)\b/i,
  },
  {
    type: "APPENDIX",
    pattern: /^\s*(appendix|appendices|anhang|anlagen)\b/i,
  },
  {
    type: "LIST_OF_ABBREVIATIONS",
    pattern:
      /^\s*(list\s+of\s+abbreviations|abbreviations|abkürzungsverzeichnis|abkuerzungsverzeichnis)\b/i,
  },
];

/**
 * A heading survives extraction wearing whatever the source format left on it:
 * markdown hashes, bold fences, section numbering, a trailing colon. Stripping
 * those before matching is what lets `## References` and `**Literaturverzeichnis**`
 * be recognised as the headings they are — extracted documents in this pipeline
 * are markdown-flavoured, so an unstripped matcher misses the common case.
 */
export function stripHeadingDecoration(line: string): string {
  return line
    .replace(/^[#>\s]+/, "")
    .replace(/^[*_]+/, "")
    .replace(/[*_]+$/, "")
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/, "")
    .replace(/^[IVXLC]+[.)]\s+/, "")
    .replace(/[:.\s]+$/, "")
    .trim();
}

/** Longest a line can be and still plausibly be a section heading. */
const MAX_HEADING_CHARS = 60;

/** Matches a leading heading against the known section names. */
export function matchHeading(pageText: string): PageType | null {
  const head = pageText.slice(0, HEADING_SCAN_CHARS);

  // Test each line, not just the first: extracted text often carries a running
  // header or a page number before the real heading.
  const lines = head
    .split("\n")
    .map((line) => stripHeadingDecoration(line))
    .filter((line) => line.length > 0 && line.length <= MAX_HEADING_CHARS)
    .slice(0, 4);

  for (const line of lines) {
    for (const { type, pattern } of HEADING_PATTERNS) {
      if (pattern.test(line)) return type;
    }
  }

  return null;
}

/**
 * A reference-list heading, matched as a WHOLE line.
 *
 * Deliberately stricter than `HEADING_PATTERNS`: this one is tested against
 * every line of a page rather than the first four, so a page that merely
 * mentions references in a sentence must not match. The line has to BE the
 * heading and nothing else.
 */
const BIBLIOGRAPHY_HEADING_LINE =
  /^(?:references?(?:\s+list)?|bibliography|works\s+cited|literature\s+cited|literaturverzeichnis|quellenverzeichnis|quellen|literatur|sources)$/i;

/** True when this single line IS a reference-list heading and nothing else. */
export function isBibliographyHeadingLine(line: string): boolean {
  const stripped = stripHeadingDecoration(line);
  return (
    stripped.length <= MAX_HEADING_CHARS &&
    BIBLIOGRAPHY_HEADING_LINE.test(stripped)
  );
}

/**
 * Finds where a reference list BEGINS inside a page, not merely whether the
 * page is one.
 *
 * This is the difference between finding a bibliography and missing it. Page
 * classification is whole-page, and `matchHeading` only inspects the first
 * few lines — so the overwhelmingly common layout, where "References" follows
 * the conclusion partway down an otherwise ordinary body page, reads as BODY
 * and every entry above the page break is lost.
 *
 * Returns the character offset of the heading line, or null.
 */
export function findBibliographyStart(pageText: string): number | null {
  let offset = 0;

  for (const line of pageText.split("\n")) {
    if (isBibliographyHeadingLine(line)) return offset;
    // +1 for the newline consumed by the split.
    offset += line.length + 1;
  }

  return null;
}

/**
 * Does this page read like a CONTINUATION of a reference list already started?
 *
 * More forgiving than `looksLikeBibliography`, and that is the point: the
 * stricter test demands editorial markers (`pp.`, `vol.`, `doi:`), which a
 * plain author–date list simply does not contain, so it rejects real
 * continuation pages. Here we already know we are inside the section and only
 * need to see that it has not ended.
 */
export function continuesBibliography(pageText: string): boolean {
  const heading = matchHeading(pageText);
  if (heading !== null && heading !== "BIBLIOGRAPHY") return false;

  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return false;

  // More than one full paragraph means the prose has resumed.
  const proseLines = lines.filter(
    (line) => line.length > 200 && /[.!?]\s*$/.test(line),
  );
  if (proseLines.length > 1) return false;

  return countEntrySignals(pageText, lines) >= 2;
}

/**
 * Counts the marks of a reference entry: a year, a list marker, or a line
 * opening "Surname, A." — the three shapes every citation style produces.
 */
function countEntrySignals(text: string, lines: readonly string[]): number {
  const years = text.match(/\((?:19|20)\d{2}[a-z]?\)|\b(?:19|20)\d{2}[a-z]?\./g);
  const numbered = lines.filter((line) =>
    /^(?:\[\d+\]|\(\d+\)|\d+[.)])\s+\S/.test(line),
  );
  const authorish = lines.filter((line) =>
    /^\p{Lu}[\p{L}'’-]+,\s*\p{Lu}/u.test(line),
  );

  return Math.max(years?.length ?? 0, numbered.length, authorish.length);
}

/** Whether a slice of text carries enough entry shape to be a reference list. */
export function hasReferenceShape(text: string): boolean {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return countEntrySignals(text, lines) >= 1;
}

/**
 * Detects a reference list by shape rather than by heading.
 *
 * Catches continuation pages — a bibliography running over six pages has its
 * heading only on the first. Signals: many short lines, a high density of
 * years in parentheses, and almost no sentence-length prose.
 */
export function looksLikeBibliography(pageText: string): boolean {
  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 4) return false;

  const yearMatches = pageText.match(/\((19|20)\d{2}[a-z]?\)/g) ?? [];
  const yearDensity = yearMatches.length / lines.length;

  // A prose paragraph is long and ends in a full stop; an entry is neither.
  const proseLines = lines.filter(
    (line) => line.length > 200 && /[.!?]\s*$/.test(line),
  );

  const hasEditorialMarkers =
    /\b(pp?\.|vol\.|no\.|ed\.|eds\.|hrsg\.|doi:|retrieved from|abgerufen)\b/i.test(
      pageText,
    );

  return yearDensity > 0.3 && proseLines.length <= 1 && hasEditorialMarkers;
}

/**
 * Detects a table of contents by shape — dot leaders and trailing page numbers.
 */
export function looksLikeToc(pageText: string): boolean {
  const dotLeaders = pageText.match(/\.{4,}\s*\d+/g) ?? [];
  if (dotLeaders.length >= 4) return true;

  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 6) return false;

  const numbered = lines.filter((line) => /^\d+(\.\d+)*\s+\S/.test(line));
  const endsWithPageNumber = lines.filter((line) => /\s\d{1,3}$/.test(line));

  return numbered.length >= 5 && endsWithPageNumber.length >= 5;
}

export interface HeuristicInput {
  pageNumber: number;
  text: string;
}

export interface HeuristicResult {
  pageNumber: number;
  pageType: PageType;
  /** False when the model should adjudicate this page. */
  confident: boolean;
}

/**
 * Classifies every page by rule, marking the unresolved ones for the model.
 *
 * Section inheritance is the important behaviour: once a BIBLIOGRAPHY or
 * APPENDIX heading is seen, subsequent pages inherit that type until a
 * different section heading appears. Without it, page two of a reference list
 * falls through to BODY and gets analysed as prose.
 */
export function classifyByHeuristics(
  pages: readonly HeuristicInput[],
): HeuristicResult[] {
  const results: HeuristicResult[] = [];

  // Sections that continue across pages until something else starts.
  let inheriting: PageType | null = null;

  for (const page of pages) {
    const trimmed = page.text.trim();

    // Page 1 is the cover by convention, and is never ambiguous enough to
    // spend a model call on.
    if (page.pageNumber === 1) {
      results.push({
        pageNumber: page.pageNumber,
        pageType: "COVER",
        confident: true,
      });
      continue;
    }

    // A page with almost no text carries no signal either way. Marked as OTHER
    // and confident, because asking a model about a blank page wastes a call.
    if (trimmed.length < 40) {
      results.push({
        pageNumber: page.pageNumber,
        pageType: "OTHER",
        confident: true,
      });
      continue;
    }

    const heading = matchHeading(trimmed);

    if (heading) {
      inheriting =
        heading === "BIBLIOGRAPHY" || heading === "APPENDIX" ? heading : null;
      results.push({
        pageNumber: page.pageNumber,
        pageType: heading,
        confident: true,
      });
      continue;
    }

    if (inheriting) {
      // An inherited APPENDIX page that reads like prose is genuinely
      // ambiguous — appendices commonly contain body-like material.
      const stillLooksRight =
        inheriting === "BIBLIOGRAPHY" ? looksLikeBibliography(trimmed) : true;

      results.push({
        pageNumber: page.pageNumber,
        pageType: inheriting,
        confident: stillLooksRight,
      });
      continue;
    }

    if (looksLikeToc(trimmed)) {
      results.push({
        pageNumber: page.pageNumber,
        pageType: "TOC",
        confident: true,
      });
      continue;
    }

    if (looksLikeBibliography(trimmed)) {
      inheriting = "BIBLIOGRAPHY";
      results.push({
        pageNumber: page.pageNumber,
        pageType: "BIBLIOGRAPHY",
        confident: true,
      });
      continue;
    }

    // Front matter: short, early, and not otherwise identified.
    const isEarly = page.pageNumber <= 5;
    const isShort = trimmed.length < 900;

    results.push({
      pageNumber: page.pageNumber,
      pageType: "BODY",
      // Long pages after the front matter are overwhelmingly body text; only
      // the short early ones are worth a model call.
      confident: !(isEarly && isShort),
    });
  }

  return results;
}
