"use client";

import * as React from "react";

import { nudgeAnalysis } from "@/lib/analysis/actions";

/**
 * Keeps a stalled queue moving.
 *
 * ---------------------------------------------------------------------------
 * WHY A CLIENT-SIDE NUDGE EXISTS AT ALL
 * ---------------------------------------------------------------------------
 * Work is normally started by `kickWorker()` the moment a job is enqueued, and
 * Vercel Cron sweeps the queue once a minute as the safety net. Neither is
 * guaranteed: the kick is fire-and-forget, so a serverless instance that is
 * torn down right after responding can drop it — and in LOCAL DEVELOPMENT there
 * is no cron at all, so a dropped kick means the upload sits at "Reading your
 * document" forever with no way back.
 *
 * This watches the progress the page is already polling. If nothing has changed
 * for `STALL_MS` while work is still outstanding, it asks the server to kick
 * the worker again. `nudgeAnalysis` re-verifies ownership and only fires when
 * the analysis is genuinely still GENERATING, so a nudge can never start work
 * that was not already queued.
 *
 * Deliberately slow and rate-limited: this is a backstop, not a scheduler.
 */

/** No observed progress for this long means the queue is probably asleep. */
const STALL_MS = 12_000;

/** Never nudge more often than this, however long the stall lasts. */
const NUDGE_COOLDOWN_MS = 20_000;

/** How often the stall condition is evaluated. */
const TICK_MS = 4_000;

export function useWorkerNudge(args: {
  /** The upload whose analysis should be nudged; null disables the hook. */
  uploadId: string | null;
  /** True while work is still outstanding. The hook is inert when false. */
  isPending: boolean;
  /**
   * A value that changes whenever real progress is observed — typically the job
   * statuses joined together. Any change resets the stall timer.
   */
  progressKey: string;
}): void {
  const { uploadId, isPending, progressKey } = args;

  // Seeded in the effect below rather than inline: reading the clock during
  // render is impure, and that effect runs on mount anyway.
  const lastProgressAt = React.useRef(0);
  const lastNudgeAt = React.useRef(0);

  // Progress observed — the queue is alive, so restart the clock.
  React.useEffect(() => {
    lastProgressAt.current = Date.now();
  }, [progressKey]);

  React.useEffect(() => {
    if (!uploadId || !isPending) return;

    const timer = setInterval(() => {
      const now = Date.now();
      if (now - lastProgressAt.current < STALL_MS) return;
      if (now - lastNudgeAt.current < NUDGE_COOLDOWN_MS) return;

      lastNudgeAt.current = now;
      // Fire-and-forget: a failed nudge is retried on the next tick, and the
      // student never needs to know this happened.
      void nudgeAnalysis(uploadId).catch(() => {});
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [uploadId, isPending]);
}
