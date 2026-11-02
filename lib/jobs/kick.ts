import "server-only";

import { publicEnv } from "@/lib/env";
import { readServerEnv } from "@/lib/env";

/**
 * Wakes the worker immediately after enqueueing.
 *
 * Cron runs once a minute, which would mean a student watching the ingestion
 * page stares at "Reading your document" for up to sixty seconds before
 * anything happens. This makes work start within milliseconds instead.
 *
 * Fire-and-forget by design: cron is the safety net, so a failure to reach the
 * worker is logged and swallowed. Awaiting it would make the upload action as
 * slow as the first job, and throwing would fail an upload that actually
 * succeeded.
 */
export function kickWorker(): void {
  void dispatch().catch((error) => {
    console.error(
      "[kick] worker unreachable; cron will pick the job up",
      error,
    );
  });
}

async function dispatch(): Promise<void> {
  const env = readServerEnv();
  const secret = env.WORKER_SECRET;

  if (!secret) {
    console.warn("[kick] WORKER_SECRET not set; skipping kick");
    return;
  }

  const response = await fetch(`${publicEnv.NEXT_PUBLIC_SITE_URL}/api/worker`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": secret,
    },
    /*
     * Generous, and deliberately longer than the drain it triggers.
     *
     * This used to abort after 3s on the theory that we only need the request
     * to land. That was wrong twice over. Aborting the fetch aborts the
     * *request*, and the worker route sees its signal cancelled mid-drain — so
     * the timeout did not just stop waiting, it killed the work. And 3s is
     * never enough on the first call in development, where Next has to compile
     * `/api/worker` before it can even respond (10s+ from cold), which is why
     * the very first upload always logged "worker unreachable".
     *
     * Nothing waits on this promise — `kickWorker` voids it — so a long ceiling
     * costs the caller nothing. It exists only so a hung socket cannot leak.
     */
    signal: AbortSignal.timeout(300_000),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[kick] worker returned", response.status);
  }
}
