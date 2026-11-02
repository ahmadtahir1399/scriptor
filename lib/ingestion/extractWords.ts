/**
 * Word geometry extraction.
 *
 * This is the most failure-prone code in the product. A highlight landing on
 * the wrong sentence makes the whole tool look broken, so the two things that
 * usually go wrong are handled explicitly here:
 *
 *  1. `getTextContent()` returns TEXT RUNS, not words. A single item is
 *     frequently a whole phrase or an entire line. Treating one item as one
 *     word gives every highlight the width of its containing phrase. We split
 *     runs ourselves and distribute the run's measured width across the
 *     characters.
 *
 *  2. PDF's origin is bottom-left; the DOM's is top-left. Storing PDF
 *     coordinates unconverted puts every highlight at the wrong end of the
 *     page, and — worse — the error is small on short pages, so it looks like
 *     a rounding bug rather than a flipped axis.
 *
 * Everything here is a pure function over plain data, so it is unit-testable
 * without a PDF and reusable by P11 for guideline documents.
 */

/** Minimal shape of a pdf.js text item — avoids depending on its types. */
export interface TextItemLike {
  str: string;
  /** [scaleX, skewX, skewY, scaleY, translateX, translateY] */
  transform: number[];
  width: number;
  height: number;
  /** True when pdf.js inserted this as an end-of-line marker. */
  hasEOL?: boolean;
}

export interface ExtractedWord {
  text: string;
  /** Left edge, PDF units, origin top-left after conversion. */
  x1: number;
  /** Top edge, PDF units, origin top-left after conversion. */
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

/**
 * Converts one text run into positioned words.
 *
 * Width distribution is proportional to character count, INCLUDING the spaces
 * between words. That matters: advancing the cursor by only the word widths
 * accumulates a leftward drift across a long run, so by the end of a line
 * every box sits noticeably left of its glyphs.
 *
 * This assumes roughly uniform character advance within a run, which is a
 * simplification for proportional fonts. It is accurate enough for a word-level
 * highlight box — pdf.js does not expose per-glyph advances without rendering,
 * and rendering every page to measure them would cost far more than the
 * precision is worth here.
 */
export function extractWordsFromItem(
  item: TextItemLike,
  viewportHeight: number,
): ExtractedWord[] {
  const raw = item.str;
  if (raw.trim().length === 0) return [];

  const transform = item.transform;
  const originX = transform[4] ?? 0;
  const originY = transform[5] ?? 0;

  // pdf.js reports height as 0 for some fonts; fall back to the vertical scale
  // component of the transform, which is the font size in text space.
  const itemHeight =
    item.height > 0 ? item.height : Math.abs(transform[3] ?? 0);

  // The axis flip. transform[5] is the BASELINE measured up from the bottom of
  // the page; subtracting it from the page height gives the baseline measured
  // down from the top, and subtracting the glyph height again gives the top
  // edge of the box.
  const topY = viewportHeight - originY - itemHeight;

  const totalChars = raw.length;
  if (totalChars === 0) return [];

  const unitWidth = item.width / totalChars;

  const words: ExtractedWord[] = [];
  // Walk the run once, tracking each token's character offset so x is derived
  // from position in the string rather than accumulated float additions.
  const tokenPattern = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(raw)) !== null) {
    const token = match[0];
    const startIndex = match.index;

    const x1 = originX + startIndex * unitWidth;
    const width = token.length * unitWidth;

    words.push({
      text: token,
      x1,
      y1: topY,
      x2: x1 + width,
      y2: topY + itemHeight,
      width,
      height: itemHeight,
    });
  }

  return words;
}

/** Applies `extractWordsFromItem` across a whole page's items. */
export function extractWordsFromItems(
  items: readonly TextItemLike[],
  viewportHeight: number,
): ExtractedWord[] {
  const words: ExtractedWord[] = [];
  for (const item of items) {
    words.push(...extractWordsFromItem(item, viewportHeight));
  }
  return words;
}

/**
 * Fraction of the font size that counts as a word gap.
 *
 * A space in a typical text face advances about a quarter to a third of the em.
 * Kerning and tracking adjustments between glyphs of the SAME word are far
 * smaller than that, so this threshold separates the two cleanly. Set it much
 * lower and tracked headings split into letters again; much higher and genuine
 * spaces in tightly-set text are swallowed.
 */
const SPACE_GAP_RATIO = 0.2;

/** Baseline shift, relative to font size, that counts as a new line. */
const LINE_BREAK_RATIO = 0.5;

/**
 * Reconstructs readable page text from runs.
 *
 * Uses the run strings rather than joining the extracted words, so the text a
 * model sees matches what a human reading the PDF would see.
 *
 * ---------------------------------------------------------------------------
 * SPACING IS DECIDED BY GEOMETRY, NOT BY RUN BOUNDARIES.
 * ---------------------------------------------------------------------------
 * A text run is NOT a word. Many PDFs — anything with kerning pairs, tracked
 * headings, or per-character positioning — emit one item per glyph. This used
 * to append a space after every run that did not already end in one, which
 * turned such a page into "u s i n g t h e p r i n c i p l e o f": text a human
 * can still squint at but a model reads as gibberish, and every check built on
 * top of it then reports nonsense.
 *
 * So we compare each item's start against where the previous one ended. A gap
 * wide enough to be a space becomes one; glyphs sitting flush against their
 * predecessor are concatenated into the word they actually spell.
 */
export function buildPageText(items: readonly TextItemLike[]): string {
  let text = "";
  // End of the previous run in PDF space, and the baseline it sat on.
  let prevEndX: number | null = null;
  let prevBaselineY = 0;
  let prevFontSize = 0;
  let prevForcedBreak = false;

  for (const item of items) {
    if (item.str.length === 0) {
      // Zero-length runs still carry hasEOL, which is how pdf.js signals a
      // line break with no glyphs of its own.
      if (item.hasEOL) prevForcedBreak = true;
      continue;
    }

    const startX = item.transform[4] ?? 0;
    const baselineY = item.transform[5] ?? 0;
    const fontSize =
      item.height > 0 ? item.height : Math.abs(item.transform[3] ?? 0);

    if (prevEndX !== null) {
      const sameLine =
        Math.abs(baselineY - prevBaselineY) <= prevFontSize * LINE_BREAK_RATIO;

      if (prevForcedBreak || !sameLine) {
        text += "\n";
      } else if (
        // Never double up on whitespace the run already carries.
        !text.endsWith(" ") &&
        !item.str.startsWith(" ") &&
        // A negative gap means the writer moved backwards (overprinting, or a
        // fresh column); treat only a genuine forward gap as a space.
        startX - prevEndX > Math.max(prevFontSize, fontSize) * SPACE_GAP_RATIO
      ) {
        text += " ";
      }
    }

    text += item.str;

    prevEndX = startX + item.width;
    prevBaselineY = baselineY;
    prevFontSize = fontSize > 0 ? fontSize : prevFontSize;
    prevForcedBreak = item.hasEOL === true;
  }

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
