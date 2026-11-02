import { describe, expect, it } from "vitest";

import { scoreTone } from "@/lib/analysis/presentation";
import { scoreBand } from "@/lib/analysis/scoring";

/**
 * `scoreTone` decides the colour of the score gauge, the score chip, the
 * sparkline and every category bar. It used to own thresholds that disagreed
 * with `scoreBand`'s, so a 70–74 score rendered as "Solid" in caution honey —
 * the label and the colour contradicting each other on the same gauge.
 *
 * These tests exist to keep the two from drifting apart again.
 */
describe("scoreTone", () => {
  it("maps each band to its tone", () => {
    expect(scoreTone(null)).toBe("muted");
    expect(scoreTone(0)).toBe("critical");
    expect(scoreTone(49)).toBe("critical");
    expect(scoreTone(50)).toBe("warning");
    expect(scoreTone(69)).toBe("warning");
    expect(scoreTone(70)).toBe("verified");
    expect(scoreTone(84)).toBe("verified");
    expect(scoreTone(85)).toBe("verified");
    expect(scoreTone(100)).toBe("verified");
  });

  it("never contradicts the band label", () => {
    // A score the app calls "solid" or "strong" must not be painted as a
    // problem, and one it calls "needs_work" must not be painted as passing.
    for (let score = 0; score <= 100; score += 1) {
      const band = scoreBand(score);
      const tone = scoreTone(score);

      if (band === "solid" || band === "strong") {
        expect(tone).toBe("verified");
      }
      if (band === "needs_work") {
        expect(tone).toBe("critical");
      }
    }
  });
});
