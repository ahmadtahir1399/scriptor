import { describe, expect, it } from "vitest";

import {
  buildPageText,
  extractWordsFromItem,
  type TextItemLike,
} from "../extractWords";

/**
 * Text-run fixtures.
 *
 * `transform` is [scaleX, skewX, skewY, scaleY, x, y] and `y` is the BASELINE
 * measured up from the bottom of the page, which is why the line-break cases
 * below use a *smaller* y for the following line.
 */
function item(
  str: string,
  x: number,
  y: number,
  width: number,
  {
    fontSize = 10,
    hasEOL = false,
  }: { fontSize?: number; hasEOL?: boolean } = {},
): TextItemLike {
  return {
    str,
    transform: [fontSize, 0, 0, fontSize, x, y],
    width,
    height: fontSize,
    hasEOL,
  };
}

describe("buildPageText", () => {
  it("joins runs that split a single word, rather than spacing them apart", () => {
    // The case that matters: PDFs routinely break a word across runs at a
    // kerning pair or ligature. "us" ends at x=110 and "ing" starts there, so
    // there is no gap and therefore no space.
    const items = [item("us", 100, 700, 10), item("ing", 110, 700, 15)];

    expect(buildPageText(items)).toBe("using");
  });

  it("inserts a space when the gap is wide enough to be one", () => {
    // "the" ends at x=115; "cat" starts at 122 — a 7pt gap on a 10pt font.
    const items = [item("the", 100, 700, 15), item("cat", 122, 700, 15)];

    expect(buildPageText(items)).toBe("the cat");
  });

  it("does not double a space the run already carries", () => {
    const items = [item("the ", 100, 700, 18), item("cat", 122, 700, 15)];

    expect(buildPageText(items)).toBe("the cat");
  });

  it("breaks the line when the baseline moves", () => {
    const items = [item("first", 100, 700, 20), item("second", 100, 688, 25)];

    expect(buildPageText(items)).toBe("first\nsecond");
  });

  it("honours an explicit end-of-line marker", () => {
    const items = [
      item("first", 100, 700, 20, { hasEOL: true }),
      item("second", 130, 700, 25),
    ];

    expect(buildPageText(items)).toBe("first\nsecond");
  });

  it("treats a backwards jump as a break, not a space", () => {
    // A new column: x goes backwards. The old implementation blindly appended a
    // space and ran the two columns together on one line.
    const items = [item("left", 100, 700, 20), item("right", 40, 690, 25)];

    expect(buildPageText(items)).toBe("left\nright");
  });

  it("keeps letter-spaced text intact when the PDF itself is tracked", () => {
    /*
     * Documented limitation, not an aspiration.
     *
     * Some documents set type with wide tracking, and pdf.js reports the whole
     * word as ONE run whose `str` already contains the spaces — "u s i n g".
     * The per-glyph advances needed to tell those spaces from real ones are not
     * exposed by `getTextContent()`, so nothing here can recover the word, and
     * guessing where words end would corrupt correctly-extracted documents.
     * This test pins the behaviour so a future de-tracking attempt is a
     * deliberate change rather than an accident.
     */
    const items = [
      item("u s i n g", 100, 700, 27),
      item("t h e", 135, 700, 16),
    ];

    expect(buildPageText(items)).toBe("u s i n g t h e");
  });
});

describe("extractWordsFromItem", () => {
  it("splits a run into words and flips the y axis", () => {
    // Page is 800 tall; baseline at 700 with a 10pt glyph puts the box top at
    // 800 - 700 - 10 = 90.
    const words = extractWordsFromItem(item("hello world", 100, 700, 55), 800);

    expect(words.map((w) => w.text)).toEqual(["hello", "world"]);
    expect(words[0]?.y1).toBe(90);
    expect(words[0]?.y2).toBe(100);
    expect(words[0]?.x1).toBe(100);
  });

  it("distributes width across characters including the spaces", () => {
    // 11 chars over 55pt = 5pt each. "world" starts at index 6 → x = 100 + 30.
    const words = extractWordsFromItem(item("hello world", 100, 700, 55), 800);

    expect(words[1]?.x1).toBe(130);
    expect(words[1]?.width).toBe(25);
  });

  it("ignores whitespace-only runs", () => {
    expect(extractWordsFromItem(item("   ", 100, 700, 15), 800)).toEqual([]);
  });

  it("falls back to the transform scale when height is reported as zero", () => {
    const zeroHeight: TextItemLike = {
      str: "x",
      transform: [12, 0, 0, 12, 100, 700],
      width: 6,
      height: 0,
    };

    expect(extractWordsFromItem(zeroHeight, 800)[0]?.height).toBe(12);
  });
});
