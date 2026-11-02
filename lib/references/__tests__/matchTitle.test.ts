import { describe, expect, it } from "vitest";

import {
  assessMatch,
  authorsAgree,
  normaliseForMatch,
  surnameOf,
  titleSimilarity,
} from "@/lib/references/matchTitle";
import {
  TITLE_MATCH_THRESHOLD,
  TITLE_SEARCH_FLOOR,
} from "@/lib/references/config";

/**
 * Title agreement is what separates VERIFIED from NEEDS_CORRECTION — a DOI that
 * resolves to a *different* paper than the one cited is the feature's most
 * important catch. These cases probe the real disagreements between two records
 * of the same work (subtitles, diacritics, "&") and guard against a coincidental
 * match to a genuinely different paper.
 */

describe("normaliseForMatch", () => {
  it("strips diacritics, case and punctuation", () => {
    expect(normaliseForMatch("Über die Moderne: Eine Studie!")).toBe(
      "uber die moderne eine studie",
    );
  });
});

describe("surnameOf", () => {
  it("extracts the surname from both orderings", () => {
    expect(surnameOf("Ashish Vaswani")).toBe("vaswani");
    expect(surnameOf("Vaswani, Ashish")).toBe("vaswani");
  });
});

describe("titleSimilarity", () => {
  it("scores an identical title at 1", () => {
    expect(
      titleSimilarity("Attention Is All You Need", "Attention Is All You Need"),
    ).toBe(1);
  });

  it("stays high when the candidate adds a subtitle", () => {
    const score = titleSimilarity(
      "Attention Is All You Need",
      "Attention Is All You Need: A Transformer Architecture",
    );
    expect(score).toBeGreaterThan(0.7);
  });

  it("scores a genuinely different title low", () => {
    const score = titleSimilarity(
      "Attention Is All You Need",
      "Deep Residual Learning for Image Recognition",
    );
    expect(score).toBeLessThan(0.3);
  });
});

describe("authorsAgree", () => {
  it("accepts a single shared surname across abbreviated lists", () => {
    expect(
      authorsAgree(["Vaswani et al."], ["Ashish Vaswani", "Noam Shazeer"]),
    ).toBe(true);
  });

  it("rejects disjoint author lists", () => {
    expect(authorsAgree(["Bahdanau"], ["Vaswani", "Shazeer"])).toBe(false);
  });
});

describe("assessMatch", () => {
  it("marks a matching title + author as the same work", () => {
    const result = assessMatch(
      { title: "Attention Is All You Need", authors: ["Vaswani"] },
      { title: "Attention Is All You Need", authors: ["Ashish Vaswani"] },
      0.6,
    );
    expect(result.isSameWork).toBe(true);
  });

  it("marks a different paper at the same DOI as NOT the same work", () => {
    const result = assessMatch(
      { title: "Attention Is All You Need", authors: ["Vaswani"] },
      {
        title: "Deep Residual Learning for Image Recognition",
        authors: ["He"],
      },
      0.6,
    );
    expect(result.isSameWork).toBe(false);
  });
});

/**
 * The floor that decides whether a SEARCH result is about the cited work at
 * all. Crossref, OpenAlex and Semantic Scholar always return their best guess,
 * so without this bar a fabricated reference is reported against a real paper
 * it has nothing to do with, and NOT_FOUND can never be reached.
 *
 * The similarity figures below were measured against the live APIs.
 */
describe("TITLE_SEARCH_FLOOR", () => {
  it("rejects the top hit for a fabricated reference", () => {
    const measured = titleSimilarity(
      "Recursive heuristics for polychromatic sediment triage in urban watersheds",
      "Spatial and temporal patterns of suspended sediment transport in nested urban watersheds",
    );
    expect(measured).toBeLessThan(TITLE_SEARCH_FLOOR);
  });

  it("rejects a top hit that shares almost nothing with the citation", () => {
    const measured = titleSimilarity(
      "Measuring hybrid work intensity: a working paper",
      "Accounting for social difference when measuring cultural diversity",
    );
    expect(measured).toBeLessThan(TITLE_SEARCH_FLOOR);
  });

  it("keeps a genuine match well clear of the floor", () => {
    const measured = titleSimilarity(
      "The what and why of goal pursuits: Human needs and the self-determination of behavior",
      'The "What" and "Why" of Goal Pursuits: Human Needs and the Self-Determination of Behavior',
    );
    expect(measured).toBeGreaterThanOrEqual(TITLE_MATCH_THRESHOLD);
  });

  it("leaves a usable band for a close-but-different title", () => {
    expect(TITLE_SEARCH_FLOOR).toBeLessThan(TITLE_MATCH_THRESHOLD);
  });
});
