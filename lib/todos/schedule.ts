import { DAILY_CAPACITY_MINUTES, TODO_LIMITS } from "@/lib/todos/config";

/**
 * To-do planning maths and the effort/provenance encoding.
 *
 * PURE. No I/O, no database, no clock except the `now` you pass in. Two concerns
 * live here, both testable in isolation:
 *
 *   1. EFFORT + PROVENANCE ENCODING. `todo_items` has no effort or is-manual
 *      column, so the estimate (minutes) and whether the task is the student's
 *      own are encoded into a leading token in `description` — the same
 *      "structured data in a text column" pattern used elsewhere. The token is
 *      stripped for display, so the student never sees it.
 *
 *   2. FEASIBILITY. Total estimated effort vs days remaining → a calm band. Never
 *      a countdown of doom.
 *
 * Unit tested in `__tests__/schedule.test.ts`.
 */

// ---------------------------------------------------------------------------
// Effort + provenance encoding
// ---------------------------------------------------------------------------

export type TodoProvenance = "generated" | "manual";

interface DecodedDescription {
  minutes: number | null;
  provenance: TodoProvenance;
  text: string;
}

const TOKEN = /^\[([tu]):(\d*)\]\s?([\s\S]*)$/;

/** Encodes effort minutes + provenance into a description. */
export function encodeItemDescription(
  text: string,
  minutes: number | null,
  provenance: TodoProvenance,
): string {
  const marker = provenance === "manual" ? "u" : "t";
  return `[${marker}:${minutes ?? ""}] ${text}`.trimEnd();
}

/** Decodes a stored description back into its parts. Tolerant of legacy plain text. */
export function decodeItemDescription(description: string): DecodedDescription {
  const match = description.match(TOKEN);
  if (!match)
    return { minutes: null, provenance: "generated", text: description };

  const minutes = match[2] ? Number(match[2]) : null;
  return {
    minutes: minutes !== null && Number.isFinite(minutes) ? minutes : null,
    provenance: match[1] === "u" ? "manual" : "generated",
    text: match[3] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Effort parsing + formatting
// ---------------------------------------------------------------------------

/**
 * Parses a model's friendly estimate ("1h", "30m", "1h 30m", "2 hours") into
 * minutes, clamped to a believable range. Unrecognisable input falls back to a
 * modest default rather than zero.
 */
export function parseEffortToMinutes(estimate: string): number {
  const text = estimate.toLowerCase();
  let minutes = 0;

  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
  if (hours) minutes += Math.round(Number(hours[1]) * 60);

  const mins = text.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/);
  if (mins) minutes += Number(mins[1]);

  // A bare number with no unit is read as minutes.
  if (minutes === 0) {
    const bare = text.match(/(\d+)/);
    if (bare) minutes = Number(bare[1]);
  }

  if (!Number.isFinite(minutes) || minutes <= 0) return 30;
  return Math.min(
    TODO_LIMITS.maxEstimateMinutes,
    Math.max(TODO_LIMITS.minEstimateMinutes, minutes),
  );
}

/** Formats minutes into a compact "1h" / "30m" / "1h 30m" label. */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

// ---------------------------------------------------------------------------
// Feasibility
// ---------------------------------------------------------------------------

export type FeasibilityBand = "none" | "doable" | "tight";

export interface Feasibility {
  band: FeasibilityBand;
  totalMinutes: number;
  totalHours: number;
  daysRemaining: number | null;
}

/**
 * Compares total remaining effort to time until the deadline.
 *
 * Bands are deliberately only two colours plus "none": "doable" (green) and
 * "tight" (amber). There is no red — a student two days out with twenty hours of
 * work needs focus, not panic, so the message points them at the Start-here
 * group instead of alarming them.
 */
export function computeFeasibility(
  totalMinutes: number,
  deadlineIso: string | null,
  now: Date = new Date(),
): Feasibility {
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  if (!deadlineIso) {
    return { band: "none", totalMinutes, totalHours, daysRemaining: null };
  }

  const deadline = new Date(deadlineIso).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(
    0,
    Math.ceil((deadline - now.getTime()) / msPerDay),
  );

  const capacity = daysRemaining * DAILY_CAPACITY_MINUTES;
  const band: FeasibilityBand = totalMinutes <= capacity ? "doable" : "tight";

  return { band, totalMinutes, totalHours, daysRemaining };
}
