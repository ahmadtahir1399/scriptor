import { describe, expect, it } from "vitest";

import {
  scaleForWidth,
  wordBoxToRect,
  wordBoxesToRects,
  wordsInRange,
  type WordBox,
} from "@/lib/viewer/geometry";

/**
 * Highlight geometry decides where a box lands on the student's actual thesis.
 * One line off and the product feels broken, so the conversion is pinned hard —
 * especially that NO vertical flip is applied (P3 already flipped).
 */
describe("scaleForWidth", () => {
  it("is rendered width over page width", () => {
    // A page 595pt wide rendered at 892px CSS → 1.5x.
    expect(scaleForWidth(892.5, 595)).toBeCloseTo(1.5, 5);
  });

  it("is 1 when rendered at native size", () => {
    expect(scaleForWidth(595, 595)).toBe(1);
  });

  it("guards a zero page width", () => {
    expect(scaleForWidth(800, 0)).toBe(0);
  });
});

describe("wordBoxToRect", () => {
  const word: WordBox = { x1: 100, y1: 200, x2: 160, y2: 212, wordIndex: 5 };

  it("scales the box with no flip — top stays top", () => {
    const rect = wordBoxToRect(word, 2);
    expect(rect).toEqual({ left: 200, top: 400, width: 120, height: 24 });
  });

  it("is identity at scale 1", () => {
    expect(wordBoxToRect(word, 1)).toEqual({
      left: 100,
      top: 200,
      width: 60,
      height: 12,
    });
  });

  it("keeps a lower box lower — no mirroring", () => {
    const high: WordBox = { x1: 0, y1: 50, x2: 10, y2: 60, wordIndex: 0 };
    const low: WordBox = { x1: 0, y1: 700, x2: 10, y2: 710, wordIndex: 1 };
    expect(wordBoxToRect(high, 1).top).toBeLessThan(wordBoxToRect(low, 1).top);
  });
});

describe("wordBoxesToRects", () => {
  it("maps in order", () => {
    const words: WordBox[] = [
      { x1: 0, y1: 0, x2: 10, y2: 10, wordIndex: 0 },
      { x1: 20, y1: 0, x2: 30, y2: 10, wordIndex: 1 },
    ];
    const rects = wordBoxesToRects(words, 1);
    expect(rects).toHaveLength(2);
    expect(rects[0]?.left).toBe(0);
    expect(rects[1]?.left).toBe(20);
  });
});

describe("wordsInRange", () => {
  const words: WordBox[] = [0, 1, 2, 3, 4].map((i) => ({
    x1: i * 10,
    y1: 0,
    x2: i * 10 + 8,
    y2: 10,
    wordIndex: i,
  }));

  it("selects an inclusive span", () => {
    expect(wordsInRange(words, 1, 3).map((w) => w.wordIndex)).toEqual([
      1, 2, 3,
    ]);
  });

  it("selects a single word", () => {
    expect(wordsInRange(words, 2, 2).map((w) => w.wordIndex)).toEqual([2]);
  });

  it("tolerates reversed bounds", () => {
    expect(wordsInRange(words, 3, 1).map((w) => w.wordIndex)).toEqual([
      1, 2, 3,
    ]);
  });

  it("returns empty when the span is on another page", () => {
    expect(wordsInRange(words, 90, 95)).toEqual([]);
  });
});
