import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { countOpenTodos, listDueTodoItems } from "@/lib/db/queries/todos";
import { lastNotifiedAt } from "@/lib/db/queries/notifications";
import { notifyTodosDueSoon, type DueTodo } from "@/lib/notifications/events";
import { dueLabel } from "@/lib/notifications/dueLabel";
import type { DueTodoRow } from "@/lib/db/queries/todos";

/**
 * The TODO_DUE_SOON sweep.
 *
 * ── WHY A SWEEP AND NOT A JOB ────────────────────────────────────────────────
 *
 * Same reasoning as `runRetentionPurge`, which sits beside it in the worker
 * route: `analysis_jobs.paper_analysis_id` and `paper_upload_id` are NOT NULL,
 * and a deadline nudge is a scan across every user's open tasks with neither.
 * It also has no triggering event — nothing *happens* when a date arrives, which
 * is precisely why it needs a clock rather than a queue.
 *
 * ── THE THREE RULES THAT KEEP IT FROM BECOMING SPAM ──────────────────────────
 *
 * A reminder people turn off is worse than no reminder, so:
 *
 *   1. WINDOW — only tasks due within three days, or already overdue. Far-future
 *      deadlines are not news.
 *   2. QUIET PERIOD — at most one nudge per analysis per 24 hours, enforced
 *      against `notifications.created_at` rather than in memory, so it survives
 *      the worker restarting and two workers overlapping.
 *   3. GROUPED — one notification per analysis listing several tasks, never one
 *      per task. A student who set five dates on one paper gets one email.
 *
 * ── IDEMPOTENT AND FAILURE-ISOLATED ──────────────────────────────────────────
 *
 * Runs every minute from the worker cron and is a no-op on all but a handful of
 * those. Never throws: the caller in `app/api/worker/route.ts` already treats
 * sweeps as best-effort so a sweep failure cannot stop job processing.
 */

/** How far ahead to look. Three days is enough notice to actually act. */
const WINDOW_DAYS = 3;

/** One nudge per analysis per day, at most. */
const QUIET_PERIOD_MS = 24 * 60 * 60 * 1000;

/** How many tasks the email lists before it summarises the rest. */
const LISTED_LIMIT = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TodoSweepResult {
  /** Analyses that had at least one due task in the window. */
  candidates: number;
  /** Notifications actually dispatched, after the quiet period. */
  notified: number;
}

export async function runTodoDueSweep(now = new Date()): Promise<TodoSweepResult> {
  const db = createAdminClient();
  const cutoff = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);

  const due = await listDueTodoItems(db, cutoff.toISOString());
  if (due.length === 0) return { candidates: 0, notified: 0 };

  const byAnalysis = groupByAnalysis(due);
  let notified = 0;

  for (const group of byAnalysis.values()) {
    // Sequential, not Promise.all. A sweep is background work with no user
    // waiting on it, and firing hundreds of Resend calls at once is how an
    // account hits its rate limit and drops the mail it was trying to send.
    if (await notifyGroup(db, group, now)) notified += 1;
  }

  return { candidates: byAnalysis.size, notified };
}

interface AnalysisGroup {
  userId: string;
  analysisId: string;
  paperId: string;
  paperTitle: string;
  items: DueTodoRow[];
}

function groupByAnalysis(rows: readonly DueTodoRow[]): Map<string, AnalysisGroup> {
  const groups = new Map<string, AnalysisGroup>();

  for (const row of rows) {
    // Keyed by user AND analysis. The analysis id alone would be enough today
    // — an analysis has one owner — but a shared paper would silently merge two
    // students' task lists into one email, which is a data leak, not a bug in
    // the grouping.
    const key = `${row.userId}:${row.analysisId}`;
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(row);
      continue;
    }

    groups.set(key, {
      userId: row.userId,
      analysisId: row.analysisId,
      paperId: row.paperId,
      paperTitle: row.paperTitle,
      items: [row],
    });
  }

  return groups;
}

async function notifyGroup(
  db: ReturnType<typeof createAdminClient>,
  group: AnalysisGroup,
  now: Date,
): Promise<boolean> {
  try {
    const last = await lastNotifiedAt(db, {
      userId: group.userId,
      type: "TODO_DUE_SOON",
      analysisId: group.analysisId,
    });

    if (last && now.getTime() - new Date(last).getTime() < QUIET_PERIOD_MS) {
      return false;
    }

    // Soonest first — `listDueTodoItems` already orders by due_at, and grouping
    // preserves it, so the most urgent task leads the email and the preheader.
    const listed = group.items.slice(0, LISTED_LIMIT);
    const openTotal = await countOpenTodos(db, group.analysisId);

    const todos: DueTodo[] = listed.map((item) => ({
      title: item.title,
      dueLabel: dueLabel(item.dueAt, now),
      overdue: new Date(item.dueAt).getTime() < now.getTime(),
    }));

    const result = await notifyTodosDueSoon(db, {
      userId: group.userId,
      paperId: group.paperId,
      analysisId: group.analysisId,
      paperTitle: group.paperTitle,
      todos,
      // Everything open on the paper that is NOT in the list above — including
      // undated tasks, which is the honest count of what is still outstanding.
      remainingCount: Math.max(0, openTotal - listed.length),
    });

    return result.created || result.emailSent;
  } catch (error) {
    // One student's broken group must not end the sweep for everyone else.
    console.error(
      `[todoSweep] failed for analysis ${group.analysisId}`,
      error,
    );
    return false;
  }
}

export { dueLabel };
