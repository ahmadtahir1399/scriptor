import { describe, expect, it } from "vitest";

import { mergeLineRects } from "@/lib/viewer/mergeLineRects";
import type { Rect } from "@/lib/viewer/geometry";

/**
 * A multi-line finding must render as one tight rect PER LINE — never a single
 * block that swallows the gaps between lines. These cases pin that behaviour.
 */
describe("mergeLineRects", () => {
  it("returns nothing for no rects", () => {
    expect(mergeLineRects([])).toEqual([]);
  });

  it("merges words on one line into a single spanning rect", () => {
    const line: Rect[] = [
      { left: 10, top: 100, width: 20, height: 12 },
      { left: 32, top: 100, width: 18, height: 12 },
      { left: 52, top: 101, width: 24, height: 12 },
    ];
    const merged = mergeLineRects(line);
    expect(merged).toHaveLength(1);
    // left = 10, right = 52 + 24 = 76 → width 66; top 100, bottom 113 → height 13
    expect(merged[0]).toEqual({ left: 10, top: 100, width: 66, height: 13 });
  });

  it("splits two lines into two rects, never one giant box", () => {
    const twoLines: Rect[] = [
      { left: 400, top: 100, width: 30, height: 12 }, // end of line 1
      { left: 10, top: 118, width: 25, height: 12 }, // start of line 2
    ];
    const merged = mergeLineRects(twoLines);
    expect(merged).toHaveLength(2);
    // The line-1 rect must NOT stretch down to swallow line 2.
    expect(merged[0]?.top).toBe(100);
    expect(merged[0]?.height).toBe(12);
    expect(merged[1]?.top).toBe(118);
    // And it must not become one box spanning both tops.
    expect(merged.some((r) => r.height > 20)).toBe(false);
  });

  it("groups words within epsilon onto the same line", () => {
    // tops 100 and 103 are within the default epsilon (4) → one line.
    const wobbly: Rect[] = [
      { left: 0, top: 100, width: 10, height: 12 },
      { left: 12, top: 103, width: 10, height: 12 },
    ];
    expect(mergeLineRects(wobbly)).toHaveLength(1);
  });

  it("separates lines just beyond epsilon", () => {
    const apart: Rect[] = [
      { left: 0, top: 100, width: 10, height: 12 },
      { left: 0, top: 106, width: 10, height: 12 },
    ];
    expect(mergeLineRects(apart)).toHaveLength(2);
  });

  it("is order-independent — unsorted input yields sorted lines", () => {
    const unsorted: Rect[] = [
      { left: 50, top: 200, width: 10, height: 12 },
      { left: 10, top: 100, width: 10, height: 12 },
      { left: 30, top: 100, width: 10, height: 12 },
    ];
    const merged = mergeLineRects(unsorted);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.top).toBe(100);
    expect(merged[0]?.left).toBe(10);
    expect(merged[1]?.top).toBe(200);
  });
});
