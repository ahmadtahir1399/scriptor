/**
 * To-do generation & planning configuration.
 *
 * Every tunable for the action-plan feature: the daily-effort capacity the
 * feasibility signal assumes, the fan-out caps that keep generation bounded, and
 * the canonical themes the model clusters into. No magic numbers inline.
 */

/**
 * Realistic focused revision minutes a student gets done per day. The
 * feasibility signal ("very doable" / "tight") is total effort vs
 * daysRemaining × this. Deliberately modest — a plan that assumes 8-hour days is
 * the kind of false comfort this feature exists to avoid.
 */
export const DAILY_CAPACITY_MINUTES = 180;

/** Canonical themes. The model is asked to cluster into these; order is priority. */
export const TODO_THEMES = [
  "Citations & References",
  "Structure & Flow",
  "Content Depth",
  "Language & Clarity",
] as const;
export type TodoTheme = (typeof TODO_THEMES)[number];

/** Generation bounds — a runaway plan helps no one. */
export const TODO_LIMITS = {
  maxSignals: 40,
  maxGroups: 6,
  maxItemsPerGroup: 12,
  maxItems: 40,
  /** Clamp a single task's estimate to something believable. */
  minEstimateMinutes: 10,
  maxEstimateMinutes: 480,
  maxOutputTokens: 3000,
} as const;

/**
 * Marker stored in `todo_groups.description` to flag the student's own tasks'
 * group, so regeneration can delete generated groups while preserving manual
 * ones. Hidden from the UI (the manual group gets a localised title instead).
 */
export const MANUAL_GROUP_MARKER = "[manual]";

/** A low check score becomes a task; at or above this a check is not tasked. */
export const CHECK_TASK_SCORE_CEILING = 72;
