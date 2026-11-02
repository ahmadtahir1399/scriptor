import "server-only";

import type { JobKind } from "@/lib/db/enums";
import type { AnalysisJob } from "@/lib/domain/job";
import type { Db } from "@/lib/db/queries/papers";

import { parseHandler } from "@/lib/jobs/handlers/parse";
import { identifyPagesHandler } from "@/lib/jobs/handlers/identifyPages";
import { compatibilityHandler } from "@/lib/jobs/handlers/compatibility";
import { runCheckHandler } from "@/lib/jobs/handlers/runCheck";
import { grammarHandler } from "@/lib/jobs/handlers/grammar";
import { postProcessHandler } from "@/lib/jobs/handlers/postProcess";
import { bibliographyHandler } from "@/lib/jobs/handlers/bibliography";
import { referenceHealthHandler } from "@/lib/jobs/handlers/referenceHealth";
import { todoListHandler } from "@/lib/jobs/handlers/todoList";
import { defenseQuestionsHandler } from "@/lib/jobs/handlers/defenseQuestions";

/**
 * The job handler registry.
 *
 * P4 ADDS KEYS TO THIS OBJECT. It must never create a second registry — the
 * worker looks up handlers here and nowhere else, so a parallel registry would
 * produce jobs that are claimed, never run, and eventually reaped as stale
 * with no explanation.
 *
 * Every handler must be IDEMPOTENT. A job can be retried after a timeout,
 * after a crash, or after `fail_job()` backoff, so running it twice must leave
 * the same end state — in practice that means deleting its own prior output
 * before writing.
 */

export interface JobContext {
  /** Service-role client. Handlers write tables users cannot. */
  db: Db;
  /** Identifies this worker in `analysis_jobs.claimed_by`, for debugging. */
  workerId: string;
}

export type JobHandler = (job: AnalysisJob, ctx: JobContext) => Promise<void>;

/**
 * Partial by design. A job kind with no handler yet is enqueued by nobody, and
 * the runner reports an unhandled kind as a job failure with a clear message
 * rather than silently succeeding.
 */
export const JOB_HANDLERS: Partial<Record<JobKind, JobHandler>> = {
  PARSE: parseHandler,
  IDENTIFY_PAGES: identifyPagesHandler,
  COMPATIBILITY: compatibilityHandler,
  // P4 — the check engine.
  RUN_CHECK: runCheckHandler,
  GRAMMAR: grammarHandler,
  POST_PROCESSING: postProcessHandler,
  // P9 — reference health. BIBLIOGRAPHY parses the reference list and in-text
  // citations then reconciles; it chains REFERENCE_HEALTH, which verifies each
  // reference against the scholarly providers.
  BIBLIOGRAPHY: bibliographyHandler,
  REFERENCE_HEALTH: referenceHealthHandler,
  // P10 — the action plan, chained after POST_PROCESSING (a transform over the
  // completed findings, so it must run last).
  TODO_LIST: todoListHandler,
  // P11 — viva questions, likewise chained after POST_PROCESSING so the thesis's
  // finalised weaknesses drive the questions.
  DEFENSE_QUESTIONS: defenseQuestionsHandler,
  // Later prompts add: AI_DETECTION.
};

export function getHandler(kind: JobKind): JobHandler | undefined {
  return JOB_HANDLERS[kind];
}
