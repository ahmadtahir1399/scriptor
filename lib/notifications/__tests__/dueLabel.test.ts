import { describe, expect, it } from "vitest";

// From the pure module, NOT from `todoSweep` — that file is `server-only`, and
// importing it here throws before any assertion runs.
import { dueLabel } from "@/lib/notifications/dueLabel";

/**
 * Deadline phrasing, pinned.
 *
 * The label is baked into an email at SEND time and read whenever the student
 * opens it, so it has to be computed from calendar days rather than elapsed
 * milliseconds. "Due in 0 days" for something due tomorrow morning is the exact
 * failure this guards against — it reads as a bug and undermines the one thing
 * the nudge is for.
 */

const NOW = new Date("2026-08-11T14:30:00Z");

/** A local-time date, matching how `dueLabel` derives calendar boundaries. */
function at(dayOffset: number, hour: number, minute = 0): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

describe("dueLabel", () => {
  it("says 'Due today' for later the same day", () => {
    expect(dueLabel(at(0, 23), NOW)).toBe("Due today");
  });

  it("says 'Due today' for earlier the same day, not 'overdue'", () => {
    // Nine hours late is still today. Calling it overdue would be technically
    // true and unhelpfully alarming on the morning of the deadline.
    expect(dueLabel(at(0, 5), NOW)).toBe("Due today");
  });

  it("says 'Due tomorrow' for any time tomorrow, however few hours away", () => {
    // 00:30 tomorrow is ten hours out. Rounding elapsed time would call that
    // "Due in 0 days".
    expect(dueLabel(at(1, 0, 30), NOW)).toBe("Due tomorrow");
    expect(dueLabel(at(1, 23), NOW)).toBe("Due tomorrow");
  });

  it("counts whole days beyond tomorrow", () => {
    expect(dueLabel(at(2, 9), NOW)).toBe("Due in 2 days");
    expect(dueLabel(at(3, 21), NOW)).toBe("Due in 3 days");
  });

  it("names yesterday specifically", () => {
    expect(dueLabel(at(-1, 9), NOW)).toBe("Overdue since yesterday");
  });

  it("counts days for anything older", () => {
    expect(dueLabel(at(-2, 9), NOW)).toBe("Overdue by 2 days");
    expect(dueLabel(at(-14, 9), NOW)).toBe("Overdue by 14 days");
  });
});
