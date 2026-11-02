/**
 * Highlight geometry — the inverse of P3's word extraction.
 *
 * P3 stored every word's box in PDF UNITS, with each page's `page_width` /
 * `page_height`, and it ALREADY converted PDF's bottom-left origin to the DOM's
 * top-left during extraction (see the P3 coordinate note). So here:
 *
 *   scale     = renderedCanvasWidthCss / page_width
 *   rect.left = x1 * scale,  rect.top    = y1 * scale
 *   rect.width= (x2 - x1) * scale,  rect.height = (y2 - y1) * scale
 *
 * NO vertical flip is applied. If a highlight comes out mirrored, the bug is a
 * convention mismatch with P3's extraction — fix it there, never add a
 * compensating flip here, or the two ends drift apart and every future change
 * has to reason about two conflicting conventions.
 *
 * PURE — no DOM, no I/O. Unit-tested in `__tests__/geometry.test.ts`.
 */

export interface WordBox {
  /** PDF units, top-left origin (P3 already flipped from PDF bottom-left). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  wordIndex: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The one scale factor for a page: rendered CSS width over the stored PDF-unit
 * width. Height scales by the same factor because the render preserves aspect
 * ratio, so a single number covers both axes.
 */
export function scaleForWidth(
  renderedWidthCss: number,
  pageWidth: number,
): number {
  if (pageWidth <= 0) return 0;
  return renderedWidthCss / pageWidth;
}

/** One word box → one CSS rect at the given scale. */
export function wordBoxToRect(word: WordBox, scale: number): Rect {
  return {
    left: word.x1 * scale,
    top: word.y1 * scale,
    width: (word.x2 - word.x1) * scale,
    height: (word.y2 - word.y1) * scale,
  };
}

/** Every word box in an index range → its scaled rects, in index order. */
export function wordBoxesToRects(
  words: readonly WordBox[],
  scale: number,
): Rect[] {
  return words.map((word) => wordBoxToRect(word, scale));
}

/**
 * Selects the words of a finding's index span from a page's words.
 *
 * Inclusive on both ends. A finding may legitimately reference indices that are
 * not all on this page (it can cross a page break); callers pass one page's
 * words and get back only the ones that fall in range here.
 */
export function wordsInRange(
  words: readonly WordBox[],
  startIndex: number,
  endIndex: number,
): WordBox[] {
  const lo = Math.min(startIndex, endIndex);
  const hi = Math.max(startIndex, endIndex);
  return words.filter((word) => word.wordIndex >= lo && word.wordIndex <= hi);
}
