import type { Rect } from "@/lib/viewer/geometry";

/**
 * Merges the per-word rects of one finding into ONE RECT PER LINE.
 *
 * A finding spanning `word_index_start..end` often crosses lines. Drawing a
 * single bounding box over the whole span would swallow the whitespace between
 * lines and paint a fat block across half the page — the classic "this looks
 * broken" highlight. Instead we group words by line (matching `top` within a
 * small epsilon) and emit one tight rect per line, exactly as a text selection
 * would render.
 *
 * PURE — unit-tested in `__tests__/mergeLineRects.test.ts`.
 */

export const DEFAULT_LINE_EPSILON = 4;

export function mergeLineRects(
  rects: readonly Rect[],
  epsilon: number = DEFAULT_LINE_EPSILON,
): Rect[] {
  if (rects.length === 0) return [];

  // Sort top-to-bottom, then left-to-right, so words arrive in reading order
  // and each new line starts with its top-most, left-most word.
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: Rect[][] = [];
  for (const rect of sorted) {
    const currentLine = lines[lines.length - 1];
    const lineTop = currentLine?.[0]?.top;

    if (
      currentLine &&
      lineTop !== undefined &&
      Math.abs(lineTop - rect.top) <= epsilon
    ) {
      currentLine.push(rect);
    } else {
      lines.push([rect]);
    }
  }

  return lines.map((line) => {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const rect of line) {
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.left + rect.width);
      bottom = Math.max(bottom, rect.top + rect.height);
    }

    return { left, top, width: right - left, height: bottom - top };
  });
}
