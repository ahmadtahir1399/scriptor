import { describe, expect, it } from "vitest";

import {
  computeAnalysisScore,
  scoreBand,
  type CheckRating,
} from "@/lib/analysis/scoring";

/**
 * Scoring is the number a student reads as a judgement on a year of work. The
 * cases that matter most are the failure-isolation ones — an errored check must
 * never drag the grade down.
 */
describe("computeAnalysisScore", () => {
  it("returns null overall when nothing was scored", () => {
    const result = computeAnalysisScore([]);
    expect(result.overall).toBeNull();
    expect(result.scoredCount).toBe(0);
  });

  it("averages a single check to itself", () => {
    const ratings: CheckRating[] = [
      { checkCode: "CITATION_STYLE", score: 80, errored: false },
    ];
    expect(computeAnalysisScore(ratings).overall).toBe(80);
  });

  it("weights argumentation above gendering", () => {
    // ARGUMENTATION weight 1.5, GENDERING weight 0.6.
    const ratings: CheckRating[] = [
      { checkCode: "ARGUMENTATION", score: 90, errored: false },
      { checkCode: "GENDERING", score: 50, errored: false },
    ];
    // (90*1.5 + 50*0.6) / (1.5 + 0.6) = (135 + 30) / 2.1 = 78.57 → 78.6
    expect(computeAnalysisScore(ratings).overall).toBe(78.6);
  });

  it("EXCLUDES an errored check from the denominator — never scores it zero", () => {
    const withError: CheckRating[] = [
      { checkCode: "CITATION_STYLE", score: 80, errored: false },
      { checkCode: "COHERENCE", score: null, errored: true },
    ];
    // Must equal the score of the one healthy check, not a mean dragged toward 0.
    expect(computeAnalysisScore(withError).overall).toBe(80);
    expect(computeAnalysisScore(withError).scoredCount).toBe(1);
    expect(computeAnalysisScore(withError).totalCount).toBe(2);
  });

  it("treats a genuine zero differently from an error", () => {
    const genuineZero: CheckRating[] = [
      { checkCode: "CITATION_STYLE", score: 100, errored: false },
      { checkCode: "COHERENCE", score: 0, errored: false },
    ];
    // A real 0 counts: (100*1.0 + 0*1.4) / 2.4 = 41.7
    expect(computeAnalysisScore(genuineZero).overall).toBe(41.7);
  });

  it("rolls checks up into their categories", () => {
    const ratings: CheckRating[] = [
      { checkCode: "ARGUMENTATION", score: 80, errored: false },
      { checkCode: "COHERENCE", score: 60, errored: false },
      { checkCode: "CITATION_STYLE", score: 90, errored: false },
    ];
    const result = computeAnalysisScore(ratings);

    const argumentation = result.categories.find(
      (c) => c.category === "ARGUMENTATION",
    );
    const referencing = result.categories.find(
      (c) => c.category === "REFERENCING",
    );

    // ARGUMENTATION holds both argumentation (1.5) and coherence (1.4):
    // (80*1.5 + 60*1.4) / 2.9 = 70.3
    expect(argumentation?.score).toBe(70.3);
    expect(argumentation?.scoredCount).toBe(2);
    // REFERENCING holds only citation style here.
    expect(referencing?.score).toBe(90);
  });

  it("gives a category null when all its checks errored", () => {
    const ratings: CheckRating[] = [
      { checkCode: "ARGUMENTATION", score: null, errored: true },
      { checkCode: "COHERENCE", score: null, errored: true },
    ];
    const argumentation = computeAnalysisScore(ratings).categories.find(
      (c) => c.category === "ARGUMENTATION",
    );
    expect(argumentation?.score).toBeNull();
    expect(argumentation?.checkCount).toBe(2);
    expect(argumentation?.scoredCount).toBe(0);
  });
});

describe("scoreBand", () => {
  it("maps scores to bands and null to null", () => {
    expect(scoreBand(null)).toBeNull();
    expect(scoreBand(90)).toBe("strong");
    expect(scoreBand(85)).toBe("strong");
    expect(scoreBand(70)).toBe("solid");
    expect(scoreBand(50)).toBe("developing");
    expect(scoreBand(49)).toBe("needs_work");
    expect(scoreBand(0)).toBe("needs_work");
  });
});
