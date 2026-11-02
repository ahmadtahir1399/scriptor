import { describe, expect, it } from "vitest";

import {
  computeFeasibility,
  decodeItemDescription,
  encodeItemDescription,
  formatMinutes,
  parseEffortToMinutes,
} from "@/lib/todos/schedule";

/**
 * The planning maths a student's time budget rides on. Feasibility must stay
 * calm — only "doable" or "tight", never a red panic — and the effort encoding
 * must round-trip so estimates survive a reload.
 */

describe("effort parsing", () => {
  it("parses hours, minutes and combinations", () => {
    expect(parseEffortToMinutes("1h")).toBe(60);
    expect(parseEffortToMinutes("30m")).toBe(30);
    expect(parseEffortToMinutes("1h 30m")).toBe(90);
    expect(parseEffortToMinutes("2 hours")).toBe(120);
    expect(parseEffortToMinutes("45 minutes")).toBe(45);
  });

  it("clamps and falls back rather than returning zero", () => {
    expect(parseEffortToMinutes("nonsense")).toBe(30);
    expect(parseEffortToMinutes("40h")).toBe(480); // clamped to max
    expect(parseEffortToMinutes("1m")).toBe(10); // clamped to min
  });
});

describe("formatMinutes", () => {
  it("renders compact labels", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(30)).toBe("30m");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(0)).toBe("—");
  });
});

describe("description encoding", () => {
  it("round-trips minutes, provenance and text", () => {
    const encoded = encodeItemDescription(
      "Add DOIs to broken refs",
      45,
      "generated",
    );
    const decoded = decodeItemDescription(encoded);
    expect(decoded).toEqual({
      minutes: 45,
      provenance: "generated",
      text: "Add DOIs to broken refs",
    });
  });

  it("marks manual tasks distinctly", () => {
    const decoded = decodeItemDescription(
      encodeItemDescription("My own task", 60, "manual"),
    );
    expect(decoded.provenance).toBe("manual");
    expect(decoded.minutes).toBe(60);
  });

  it("tolerates a missing estimate and legacy plain text", () => {
    expect(
      decodeItemDescription(
        encodeItemDescription("No estimate", null, "generated"),
      ).minutes,
    ).toBeNull();
    expect(decodeItemDescription("plain legacy text")).toEqual({
      minutes: null,
      provenance: "generated",
      text: "plain legacy text",
    });
  });
});

describe("feasibility", () => {
  const now = new Date("2025-07-19T09:00:00Z");

  it("returns 'none' with no deadline", () => {
    expect(computeFeasibility(600, null, now).band).toBe("none");
  });

  it("is 'doable' when effort fits the days remaining", () => {
    // 9 hours of work, 6 days out (6 × 3h/day = 18h capacity).
    const result = computeFeasibility(540, "2025-07-25T09:00:00Z", now);
    expect(result.band).toBe("doable");
    expect(result.daysRemaining).toBe(6);
    expect(result.totalHours).toBe(9);
  });

  it("is 'tight' — never red — when effort exceeds capacity", () => {
    // 20 hours of work, 2 days out (2 × 3h = 6h capacity).
    const result = computeFeasibility(1200, "2025-07-21T09:00:00Z", now);
    expect(result.band).toBe("tight");
    expect(result.daysRemaining).toBe(2);
  });

  it("never reports negative days for a passed deadline", () => {
    expect(
      computeFeasibility(120, "2025-07-01T09:00:00Z", now).daysRemaining,
    ).toBe(0);
  });
});
