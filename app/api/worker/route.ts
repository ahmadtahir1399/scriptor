import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { readServerEnv } from "@/lib/env";
import { runJobs } from "@/lib/jobs/runner";
import { runRetentionPurge } from "@/lib/jobs/handlers/retentionPurge";
import { runTodoDueSweep } from "@/lib/notifications/todoSweep";
import { runWeeklyDigestSweep } from "@/lib/notifications/digestSweep";

/**
 * Job worker endpoint.
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE USES THE SERVICE-ROLE CLIENT.
 * An unauthenticated caller here would have a complete bypass of every RLS
 * policy in the database. The secret check below is the only thing standing
 * between the public internet and every user's thesis.
 * ---------------------------------------------------------------------------
 *
 * Invoked every minute by pg_cron in Supabase (see 21_worker_cron.sql) and by
 * `kick()` immediately after a job is enqueued. Both paths are safe to overlap
 * because `claim_analysis_jobs()` uses FOR UPDATE SKIP LOCKED.
 *
 * The tick used to be a Vercel Cron entry in vercel.json. It is not any more:
 * the Hobby plan caps cron at one run per DAY, which for a queue worker means
 * any job whose kick failed waits up to 24 hours. pg_net posting from the
 * database has no such cap, so the schedule lives there instead. The request it
 * sends is identical, which is why this route did not have to change.
 */

// Node runtime, not edge: pdf.js needs Node APIs, and the handlers are far
// heavier than the edge runtime's limits allow.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorised(request: NextRequest, secret: string): boolean {
  const provided =
    request.headers.get("x-worker-secret") ??
    // Vercel Cron sends its own bearer token; accept either shape.
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);

  /*
   * timingSafeEqual throws on a length mismatch, and comparing lengths first
   * would itself leak the secret's length through timing. Padding both to a
   * fixed width keeps the comparison constant-time regardless of input.
   */
  if (a.length !== b.length) {
    // Still perform a comparison so a wrong-length guess costs the same as a
    // right-length one.
    const padded = Buffer.alloc(64);
    const expected = Buffer.alloc(64);
    a.copy(padded, 0, 0, Math.min(a.length, 64));
    b.copy(expected, 0, 0, Math.min(b.length, 64));
    timingSafeEqual(padded, expected);
    return false;
  }

  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = readServerEnv();
  const secret = env.WORKER_SECRET;

  /*
   * Fail CLOSED when the secret is unconfigured. An unset secret must never
   * mean "allow everyone" — that is precisely how a service-role endpoint ends
   * up publicly reachable in production because someone forgot an env var.
   */
  if (!secret) {
    console.error("[worker] WORKER_SECRET is not set; refusing all requests");
    return new NextResponse(null, { status: 401 });
  }

  if (!isAuthorised(request, secret)) {
    // No body: an unauthenticated caller learns nothing about what is here.
    return new NextResponse(null, { status: 401 });
  }

  const result = await runJobs();

  // Reuse this cron-triggered worker for the retention purge rather than a
  // second scheduler. Failure-isolated: a purge error must never break job
  // processing. Cheap when nothing is eligible (one indexed query).
  let purged = 0;
  try {
    ({ purged } = await runRetentionPurge());
  } catch (error) {
    console.error("[worker] retention purge failed", error);
  }

  // The deadline nudge, for the same reason and with the same isolation. Also
  // cheap when idle: one query against the partial index `todo_items_due_idx`,
  // which by design matches almost nothing on almost every tick.
  let nudged = 0;
  try {
    ({ notified: nudged } = await runTodoDueSweep());
  } catch (error) {
    console.error("[worker] todo due sweep failed", error);
  }

  // The opt-in weekly digest. Returns immediately when mail is unconfigured or
  // nobody is due, which is every tick but a handful per week.
  let digests = 0;
  try {
    ({ sent: digests } = await runWeeklyDigestSweep());
  } catch (error) {
    console.error("[worker] weekly digest sweep failed", error);
  }

  return NextResponse.json({ ...result, purged, nudged, digests });
}

/** Some cron providers issue GET. Same guard, same behaviour. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
