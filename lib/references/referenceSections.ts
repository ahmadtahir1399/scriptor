import type { PageType } from "@/lib/db/enums";
import {
  continuesBibliography,
  findBibliographyStart,
  hasReferenceShape,
  isBibliographyHeadingLine,
  looksLikeBibliography,
  matchHeading,
} from "@/lib/ingestion/pageHeuristics";

/**
 * Stage 0 — decide which TEXT is the reference list.
 *
 * The reference-health feature used to take `page_type = 'BIBLIOGRAPHY'` as its
 * input and nothing else. That is wrong in the most common layout there is: a
 * reference list starts partway down the page that ends the conclusion, so the
 * page is classified BODY (correctly — most of it *is* body) and every entry
 * above the page break is invisible to the feature. Observed on a real upload:
 * six of eight references sat on a BODY page and were silently dropped, and the
 * two that survived were the only ones ever verified.
 *
 * So the section is located by its heading, wherever on the page that heading
 * falls, and the page is SLICED rather than taken or skipped whole. Page type
 * is still honoured — it is the fallback when no heading survived extraction,
 * and it keeps continuation pages attached.
 *
 * PURE. No I/O, no model call — the shape of the text is enough.
 */

export interface ReferencePageInput {
  page_number: number;
  page_type: PageType;
  page_content: string | null;
}

export interface ReferenceSection {
  page_number: number;
  page_content: string;
}

/** Page types a reference list never starts on. Front matter names sections; it isn't one. */
const NEVER_STARTS_ON: readonly PageType[] = [
  "COVER",
  "TOC",
  "ABSTRACT",
  "LIST_OF_ABBREVIATIONS",
];

/**
 * Returns the reference-list text, page by page, in document order.
 *
 * Empty when the document has no reference section — which stays an honest
 * "no bibliography found", never a guess.
 */
export function selectReferenceSections(
  pages: readonly ReferencePageInput[],
): ReferenceSection[] {
  const ordered = [...pages].sort((a, b) => a.page_number - b.page_number);

  const start = findStart(ordered);
  if (start === null) return [];

  const sections: ReferenceSection[] = [];

  const firstPage = ordered[start.index] as ReferencePageInput;
  const firstText = dropLeadingHeading(
    (firstPage.page_content ?? "").slice(start.offset),
  );
  if (firstText.length > 0) {
    sections.push({
      page_number: firstPage.page_number,
      page_content: firstText,
    });
  }

  // Walk forward while the list is still running. It ends at the first page
  // that starts a different section (an appendix, typically) or stops looking
  // like entries at all.
  for (let index = start.index + 1; index < ordered.length; index += 1) {
    const page = ordered[index] as ReferencePageInput;
    const text = (page.page_content ?? "").trim();
    if (text.length === 0) continue;

    const heading = matchHeading(text);
    if (heading !== null && heading !== "BIBLIOGRAPHY") break;

    const stillRunning =
      page.page_type === "BIBLIOGRAPHY" ||
      looksLikeBibliography(text) ||
      continuesBibliography(text);
    if (!stillRunning) break;

    sections.push({ page_number: page.page_number, page_content: text });
  }

  // A heading with nothing citation-shaped under it was a false positive — a
  // cross-reference in prose, or a contents line that survived classification.
  const collected = sections.map((section) => section.page_content).join("\n");
  if (!hasReferenceShape(collected)) return [];

  return sections;
}

/**
 * Removes the heading itself, so "References" does not go on to be parsed as
 * though it were somebody's citation.
 */
function dropLeadingHeading(text: string): string {
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first !== -1 && isBibliographyHeadingLine(lines[first] as string)) {
    return lines.slice(first + 1).join("\n").trim();
  }
  return text.trim();
}

/**
 * The single-word headings, as bare tokens. `works cited` and `literature
 * cited` are handled as a pair below.
 */
const HEADING_TOKENS = new Set([
  "references",
  "reference",
  "bibliography",
  "literaturverzeichnis",
  "quellenverzeichnis",
  "quellen",
  "literatur",
  "sources",
]);

function normaliseToken(token: string): string {
  return token.replace(/[^\p{L}]/gu, "").toLowerCase();
}

const YEAR_TOKEN = /(?:^|\D)(?:19|20)\d{2}\b/;

/**
 * The word index where the reference list starts on a page, or null.
 *
 * In-text citation extraction reads a page's WORDS, and on a page that ends in
 * the reference list it therefore reads the reference list too — turning
 * "Bracher, K. D. (1970)." into a citation of "D." in 1970 that matches no
 * entry. On a real upload that produced twelve phantom "cited but missing"
 * issues and zero genuine ones, and left all eight real references reported as
 * uncited. Everything on screen was noise.
 *
 * Words alone carry no line breaks, so the heading is found as a token instead:
 * it must be a heading word, must follow a sentence ending (so "the references
 * cited above" in prose is not one), and must have citation-shaped text after
 * it. The LAST such token wins, since prose discussing references comes before
 * the list, never after.
 */
export function findBibliographyWordCutoff(
  words: readonly { text: string; wordIndex: number }[],
): number | null {
  for (let index = words.length - 1; index >= 0; index -= 1) {
    const token = normaliseToken((words[index] as { text: string }).text);
    if (!HEADING_TOKENS.has(token) && token !== "works" && token !== "literature") {
      continue;
    }

    if (token === "works" || token === "literature") {
      const next = normaliseToken(words[index + 1]?.text ?? "");
      if (next !== "cited") continue;
    }

    const previous = words[index - 1]?.text;
    const isHeadingPosition = index === 0 || /[.!?:]$/.test(previous ?? "");
    if (!isHeadingPosition) continue;

    const after = words.slice(index + 1);
    const years = after.filter((word) => YEAR_TOKEN.test(word.text)).length;
    if (years >= 2) return index;
  }

  return null;
}

interface StartPoint {
  index: number;
  offset: number;
}

/**
 * Locates the first page of the reference list and the offset within it.
 *
 * Where the classifier already found a BIBLIOGRAPHY page, that page anchors the
 * search and only it and the page before it are examined for a heading — the
 * heading is the precise boundary, the page type is a whole-page approximation
 * of it, and the entries stranded above the boundary are exactly what this
 * function exists to recover. Narrowing the window there keeps a stray "Sources"
 * line elsewhere in the document from hijacking the anchor.
 *
 * Where the classifier found nothing, every page is fair game — that is the
 * case where the feature would otherwise report no bibliography at all.
 */
function findStart(pages: readonly ReferencePageInput[]): StartPoint | null {
  const typedIndex = pages.findIndex(
    (page) =>
      page.page_type === "BIBLIOGRAPHY" &&
      (page.page_content ?? "").trim().length > 0,
  );

  const from = typedIndex === -1 ? 0 : Math.max(0, typedIndex - 1);
  const to = typedIndex === -1 ? pages.length - 1 : typedIndex;

  for (let index = from; index <= to; index += 1) {
    const page = pages[index] as ReferencePageInput;
    const text = page.page_content ?? "";
    if (text.trim().length === 0) continue;
    if (NEVER_STARTS_ON.includes(page.page_type)) continue;

    const offset = findBibliographyStart(text);
    if (offset !== null) return { index, offset };
  }

  return typedIndex === -1 ? null : { index: typedIndex, offset: 0 };
}
