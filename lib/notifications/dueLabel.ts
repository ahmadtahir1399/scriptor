/**
 * Deadline phrasing for the TODO_DUE_SOON nudge.
 *
 * PURE, and in its own module rather than in `todoSweep.ts`, because that file
 * is `server-only` — importing it from a test throws before a single assertion
 * runs. Anything worth unit-testing does not belong behind that guard.
 *
 * The label is computed at SEND time and then frozen into an email that may be
 * opened hours later, which is why the sweep formats it rather than the
 * template: there is no live clock on the other side.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A due date as a phrase, relative to `now`.
 *
 * Measured in CALENDAR days from local midnight, not elapsed milliseconds. A
 * task due at 00:30 tomorrow is ten hours away; rounding the elapsed time would
 * label it "Due in 0 days", which reads as a bug and undermines the nudge.
 */
export function dueLabel(dueAtIso: string, now: Date): string {
  const due = new Date(dueAtIso);

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfDue = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  ).getTime();

  const days = Math.round((startOfDue - startOfToday) / DAY_MS);

  if (days < -1) return `Overdue by ${Math.abs(days)} days`;
  if (days === -1) return "Overdue since yesterday";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
