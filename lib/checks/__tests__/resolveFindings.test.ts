import { describe, expect, it } from "vitest";

import {
  dedupeOverlapping,
  normaliseForMatch,
  resolveQuoteToWordRange,
  type OverlapItem,
  type WordRef,
} from "@/lib/checks/resolveFindings";

/**
 * This is the code that decides where a highlight lands. A wrong answer here is
 * the single most visible failure the product can have, so the cases lean on
 * the ways PDF text and model output disagree: whitespace, smart quotes,
 * hyphenation.
 */

function words(...texts: string[]): WordRef[] {
  return texts.map((text, index) => ({ text, wordIndex: index }));
}

describe("resolveQuoteToWordRange", () => {
  const page = words(
    "The",
    "study",
    "found",
    "that",
    "results",
    "were",
    "significant",
    "(Müller,",
    "2019).",
  );

  it("resolves a clean multi-word quote to its span", () => {
    const range = resolveQuoteToWordRange("results were significant", page);
    expect(range).toEqual({ wordIndexStart: 4, wordIndexEnd: 6 });
  });

  it("resolves a single word", () => {
    expect(resolveQuoteToWordRange("study", page)).toEqual({
      wordIndexStart: 1,
      wordIndexEnd: 1,
    });
  });

  it("matches a citation spanning two words with trailing punctuation", () => {
    // The quote is contained within "(Müller, 2019)." once normalised, and the
    // diacritic is preserved verbatim — we never fold ü to u, because they are
    // different letters and a wrong fold would place a highlight wrongly.
    const range = resolveQuoteToWordRange("(Müller, 2019)", page);
    expect(range).toEqual({ wordIndexStart: 7, wordIndexEnd: 8 });
  });

  it("returns null for a quote that is not present — never guesses", () => {
    expect(resolveQuoteToWordRange("entirely absent phrase", page)).toBeNull();
  });

  it("returns null for an empty quote", () => {
    expect(resolveQuoteToWordRange("", page)).toBeNull();
    expect(resolveQuoteToWordRange("   ", page)).toBeNull();
  });

  it("returns null against an empty document", () => {
    expect(resolveQuoteToWordRange("anything", [])).toBeNull();
  });

  it("finds the first occurrence of a repeated phrase", () => {
    const repeated = words("data", "is", "data", "is", "final");
    expect(resolveQuoteToWordRange("data is", repeated)).toEqual({
      wordIndexStart: 0,
      wordIndexEnd: 1,
    });
  });

  it("does not match a quote inside a longer word — boundaries are respected", () => {
    // "data" must not resolve to "database". A substring match would place a
    // highlight over the wrong word; boundary alignment is the whole point.
    const doc = words("the", "database", "works");
    expect(resolveQuoteToWordRange("data", doc)).toBeNull();
  });
});

describe("normaliseForMatch", () => {
  it("folds typographic variants and collapses whitespace", () => {
    expect(normaliseForMatch("  “Hello”\n world ")).toBe('"hello" world');
    expect(normaliseForMatch("well‐known")).toBe("well-known");
  });
});

describe("dedupeOverlapping", () => {
  it("keeps the highest severity among overlapping ranges", () => {
    const items: OverlapItem[] = [
      { wordIndexStart: 4, wordIndexEnd: 6, severityRank: 1 },
      { wordIndexStart: 5, wordIndexEnd: 7, severityRank: 3 },
    ];
    const kept = dedupeOverlapping(items);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.severityRank).toBe(3);
  });

  it("keeps disjoint ranges and returns them in document order", () => {
    const items: OverlapItem[] = [
      { wordIndexStart: 20, wordIndexEnd: 22, severityRank: 2 },
      { wordIndexStart: 0, wordIndexEnd: 2, severityRank: 1 },
    ];
    const kept = dedupeOverlapping(items);
    expect(kept).toHaveLength(2);
    expect(kept[0]?.wordIndexStart).toBe(0);
    expect(kept[1]?.wordIndexStart).toBe(20);
  });

  it("prefers the wider span when severities tie", () => {
    const items: OverlapItem[] = [
      { wordIndexStart: 4, wordIndexEnd: 5, severityRank: 2 },
      { wordIndexStart: 3, wordIndexEnd: 8, severityRank: 2 },
    ];
    const kept = dedupeOverlapping(items);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toEqual({
      wordIndexStart: 3,
      wordIndexEnd: 8,
      severityRank: 2,
    });
  });
});
