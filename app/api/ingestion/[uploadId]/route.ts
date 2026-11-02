import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertOwnsUpload, getLatestAnalysisId } from "@/lib/db/queries/uploads";
import { listJobsForAnalysis } from "@/lib/db/queries/jobs";

/**
 * Polling fallback for `useIngestionProgress`.
 *
 * `analysis_jobs` has RLS on and no user policy, so the browser cannot read it
 * directly — Realtime delivers job events to the client only because the
 * subscription runs server-side. This route is the equivalent for the polling
 * path, and it re-verifies ownership rather than trusting the id in the URL.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  // Next 16: route params are async.
  { params }: { params: Promise<{ uploadId: string }> },
): Promise<NextResponse> {
  const { uploadId } = await params;

  const user = await getSessionUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const db = await createClient();

    // Ownership check against the session, never the client-supplied id alone.
    await assertOwnsUpload(db, uploadId, user.id);

    const analysisId = await getLatestAnalysisId(db, uploadId);
    if (!analysisId) {
      return NextResponse.json({ jobs: [] });
    }

    /*
     * Service-role for this read, and only this read.
     *
     * `analysis_jobs` is deliberately granted to nobody — migration 15 says
     * "No policies. No grants. Intentional." A user-scoped select therefore
     * fails with `permission denied for table analysis_jobs`, which the catch
     * below turns into a 404, and the progress UI polls forever against an
     * endpoint that can never succeed. Ownership has already been proven above
     * with the user's own client, so scoping by `analysisId` here reads only
     * rows this caller is entitled to.
     */
    const jobs = await listJobsForAnalysis(createAdminClient(), analysisId);

    // Only the fields the progress UI needs — no payloads, no internal errors
    // beyond the message already shown to the user.
    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        kind: job.kind,
        status: job.status,
        claimed_at: job.claimed_at,
        completed_at: job.completed_at,
        last_error: job.last_error,
        attempts: job.attempts,
        max_attempts: job.max_attempts,
      })),
    });
  } catch {
    // Ownership failure and a missing upload are indistinguishable on purpose.
    return new NextResponse(null, { status: 404 });
  }
}
