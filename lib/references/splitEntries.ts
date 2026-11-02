import { REFERENCE_LIMITS } from "@/lib/references/config";

/**
 * Cutting a reference section into individual entries.
 *
 * Reference lists come in wildly different shapes, so this is a heuristic — but
 * the shape it has to survive is not exotic, it is the norm: entries WRAP.
 * "Bracher, K. D. (1970). The German Dictatorship: The Origins, Structure and
 * Effects of / National Socialism. New York: Praeger." is one reference across
 * two lines, and PDF extraction has already discarded the hanging indent that
 * distinguished a wrap from a new entry. Splitting naively on newlines is what
 * put "Hill and Wang." into the database as a source of its own, which then
 * verified as UNCHECKED because there was nothing in it to look up.
 *
 * PURE. No I/O, no model call — the shape of the text is all it needs, which is
 * what makes it directly testable.
 */

export interface RawBlock {
  rawText: string;
  pageNumber: number | null;
}

const NUMBERED_ENTRY = /^\s*(?:\[\d+\]|\(\d+\)|\d+[.)])\s+/;

/** A bullet in front of an entry — markdown-flavoured lists use these. */
const BULLET_MARKER = /^\s*[-*•·]\s+/;

/** The shapes a reference entry BEGINS with. Anything else continues one. */
const ENTRY_START: readonly RegExp[] = [
  // "[12] ", "(12) ", "12. "
  /^(?:\[\d+\]|\(\d+\)|\d+[.)])\s+\S/,
  // "Bracher, K. D." / "Bracher, Karl"
  /^\p{Lu}[\p{L}'’-]+,\s*(?:\p{Lu}\.|\p{Lu}\p{Ll})/u,
  // "———." — the repeated-author dash
  /^(?:—+|-{3,}|_{3,})[.,]?\s/,
  // Anything author-like followed by a year in parentheses, early in the line.
  /^\p{Lu}[^()\n]{0,120}\((?:19|20)\d{2}[a-z]?\)/u,
  // A bulleted entry.
  /^[-*•·]\s+\p{Lu}/u,
];

function startsNewEntry(line: string): boolean {
  return ENTRY_START.some((pattern) => pattern.test(line));
}

/**
 * Splits reference-section text into candidate blocks, preserving the source
 * page so a finding can point the student back at it.
 */
export function splitBibliographyBlocks(
  pages: readonly { page_number: number; page_content: string }[],
): RawBlock[] {
  const blocks: RawBlock[] = [];

  for (const page of pages) {
    const text = page.page_content ?? "";
    if (text.trim().length === 0) continue;

    for (const raw of chooseSplit(text)) {
      const trimmed = raw
        .replace(BULLET_MARKER, "")
        .replace(/\s+/g, " ")
        .trim();
      if (trimmed.length >= 10) {
        blocks.push({
          rawText: trimmed.slice(0, REFERENCE_LIMITS.maxRawEntryChars),
          pageNumber: page.page_number,
        });
      }
    }
  }

  return blocks.slice(0, REFERENCE_LIMITS.maxBibliographyEntries);
}

/**
 * Picks the splitting strategy, most confident first.
 *
 * Numbered markers are unambiguous, so they win outright. Otherwise blank lines
 * segment the text and entry-start grouping runs INSIDE each segment — the two
 * are complementary rather than alternatives. Blank lines alone cannot see the
 * boundaries in a densely set list, and entry starts alone cannot see them in a
 * style that opens with a title rather than an author ("The Chicago Manual of
 * Style. 17th ed. …"). Composing them means neither shape is lost.
 */
function chooseSplit(text: string): string[] {
  const numbered = splitNumbered(text);
  if (numbered.length > 1) return numbered;

  if (hasBlankLineSeparation(text)) {
    return splitOnBlankLines(text).flatMap(splitOnLines);
  }

  return splitOnLines(text);
}

function splitNumbered(text: string): string[] {
  const out: string[] = [];
  let current: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (NUMBERED_ENTRY.test(line)) {
      if (current.length > 0) out.push(current.join(" "));
      current = [line.replace(NUMBERED_ENTRY, "")];
    } else if (line.trim().length > 0) {
      current.push(line.trim());
    }
  }
  if (current.length > 0) out.push(current.join(" "));
  return out;
}

function hasBlankLineSeparation(text: string): boolean {
  return /\r?\n\s*\r?\n/.test(text.trim());
}

function splitOnBlankLines(text: string): string[] {
  return text.split(/\r?\n\s*\r?\n/);
}

/**
 * One entry per line — but only where the line actually starts one. A line that
 * does not open like a citation is a wrapped continuation of the entry above it
 * and is joined back onto it.
 */
function splitOnLines(text: string): string[] {
  const out: string[] = [];
  let current: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (current.length > 0 && !startsNewEntry(line)) {
      current.push(line);
      continue;
    }

    if (current.length > 0) out.push(current.join(" "));
    current = [line];
  }

  if (current.length > 0) out.push(current.join(" "));
  return out;
}
