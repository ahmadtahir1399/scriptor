import "server-only";

import { REFERENCE_LIMITS } from "@/lib/references/config";
import type { CitationFamily } from "@/lib/validations/reference";

/**
 * Stage 2 — extract in-text citations from the body, with word ranges.
 *
 * DETERMINISTIC. No model: in-text citations follow two dominant grammars, and
 * regex recognises them far more reliably (and freely) than an LLM would.
 * Supports author-date — "(Vaswani et al., 2017)", "Bahdanau et al. (2015)" —
 * and numeric — "[12]", "[3, 4]", "[5–7]".
 *
 * The WORD RANGE is the payload that lets the viewer highlight a citation in the
 * PDF, so each match is mapped back onto the page's `words` by reconstructing
 * the page text from the tokens and locating the match within it.
 */

export interface PageWords {
  pageNumber: number;
  /** Tokens for the page, in reading order. */
  words: ReadonlyArray<{ text: string; wordIndex: number }>;
}

export interface ExtractedInText {
  rawText: string;
  authors: string[];
  year: string | null;
  numericIndex: number | null;
  family: CitationFamily;
  pageNumber: number;
  wordIndexStart: number | null;
  wordIndexEnd: number | null;
}

// A parenthetical group that contains a 4-digit year → author-date citation.
const PAREN_WITH_YEAR = /\(([^()]*\b(?:1[5-9]|20)\d{2}[a-z]?\b[^()]*)\)/g;
// "Author et al. (2015)" / "Author and Other (2020)" → narrative author-date.
const NARRATIVE =
  /([A-ZÀ-Þ][\wÀ-ÿ'’.-]+(?:\s+(?:et al\.?|and|&|und)\s+[A-ZÀ-Þ][\wÀ-ÿ'’.-]+)*)\s*\(((?:1[5-9]|20)\d{2}[a-z]?)\)/g;
// "[12]", "[3, 4]", "[5–7]" → numeric citation group.
const NUMERIC_GROUP = /\[(\d{1,4}(?:\s*[,;–-]\s*\d{1,4})*)\]/g;
const YEAR = /\b((?:1[5-9]|20)\d{2}[a-z]?)\b/;

interface CharMappedText {
  text: string;
  /** Per-word [startChar, endChar) offsets into `text`. */
  spans: ReadonlyArray<{ start: number; end: number; wordIndex: number }>;
}

/** Rebuilds page text from tokens, remembering each token's char offset. */
function buildText(words: PageWords["words"]): CharMappedText {
  const spans: { start: number; end: number; wordIndex: number }[] = [];
  let cursor = 0;
  const parts: string[] = [];

  words.forEach((word, i) => {
    if (i > 0) cursor += 1; // the joining space
    const start = cursor;
    parts.push(word.text);
    cursor += word.text.length;
    spans.push({ start, end: cursor, wordIndex: word.wordIndex });
  });

  return { text: parts.join(" "), spans };
}

/** Iterates every match of a global regex, with char offsets. */
function* matchAll(
  text: string,
  regex: RegExp,
): Generator<{
  full: string;
  groups: Array<string | undefined>;
  start: number;
  end: number;
}> {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    yield {
      full: match[0],
      groups: match.slice(1),
      start: match.index,
      end: match.index + match[0].length,
    };
    if (match.index === regex.lastIndex) regex.lastIndex += 1; // guard zero-width
  }
}

/** Maps a char span to the enclosing word-index range. */
function spanToWordRange(
  mapped: CharMappedText,
  matchStart: number,
  matchEnd: number,
): { start: number; end: number } | null {
  let first: number | null = null;
  let last: number | null = null;
  for (const span of mapped.spans) {
    if (span.end > matchStart && span.start < matchEnd) {
      if (first === null) first = span.wordIndex;
      last = span.wordIndex;
    }
  }
  return first !== null && last !== null ? { start: first, end: last } : null;
}

/** Splits a parenthetical into authors, dropping the year and locator noise. */
function parseAuthors(inner: string): string[] {
  const beforeYear = inner.split(YEAR)[0] ?? inner;
  return beforeYear
    .split(/;|,|&|\band\b|\bund\b|\bet al\.?/i)
    .map((part) => part.replace(/[()]/g, "").trim())
    .filter((part) => part.length > 1 && /[A-Za-zÀ-ÿ]/.test(part));
}

/** Expands "3, 4" and "5–7" into the individual reference numbers they cite. */
function expandNumbers(group: string): number[] {
  const numbers = new Set<number>();
  for (const part of group.split(/[,;]/)) {
    const range = part.trim().match(/^(\d{1,4})\s*[–-]\s*(\d{1,4})$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to - from >= 0 && to - from < 100) {
        for (let n = from; n <= to; n += 1) numbers.add(n);
      }
    } else {
      const single = Number(part.trim());
      if (Number.isInteger(single) && single > 0) numbers.add(single);
    }
  }
  return [...numbers];
}

export function extractInTextCitations(
  pages: readonly PageWords[],
): ExtractedInText[] {
  const out: ExtractedInText[] = [];

  for (const page of pages) {
    if (page.words.length === 0) continue;
    const mapped = buildText(page.words);

    const push = (
      rawText: string,
      partial: Omit<
        ExtractedInText,
        "rawText" | "pageNumber" | "wordIndexStart" | "wordIndexEnd"
      >,
      start: number,
      end: number,
    ): void => {
      if (out.length >= REFERENCE_LIMITS.maxInTextCitations) return;
      const range = spanToWordRange(mapped, start, end);
      out.push({
        rawText: rawText.trim().slice(0, 300),
        ...partial,
        pageNumber: page.pageNumber,
        wordIndexStart: range?.start ?? null,
        wordIndexEnd: range?.end ?? null,
      });
    };

    // Author-date, parenthetical. May contain several citations separated by ";".
    for (const match of matchAll(mapped.text, PAREN_WITH_YEAR)) {
      const inner = match.groups[0] ?? "";
      for (const chunk of inner.split(";")) {
        const yearMatch = chunk.match(YEAR);
        push(
          `(${chunk.trim()})`,
          {
            authors: parseAuthors(chunk),
            year: yearMatch?.[1] ?? null,
            numericIndex: null,
            family: "author-date",
          },
          match.start,
          match.end,
        );
      }
    }

    // Author-date, narrative: "Author (Year)".
    for (const match of matchAll(mapped.text, NARRATIVE)) {
      push(
        match.full.trim(),
        {
          authors: parseAuthors(match.groups[0] ?? ""),
          year: match.groups[1] ?? null,
          numericIndex: null,
          family: "author-date",
        },
        match.start,
        match.end,
      );
    }

    // Numeric: "[12]", "[3, 4]", "[5–7]" → one citation per referenced number.
    for (const match of matchAll(mapped.text, NUMERIC_GROUP)) {
      for (const number of expandNumbers(match.groups[0] ?? "")) {
        push(
          `[${number}]`,
          { authors: [], year: null, numericIndex: number, family: "numeric" },
          match.start,
          match.end,
        );
      }
    }
  }

  return out;
}
