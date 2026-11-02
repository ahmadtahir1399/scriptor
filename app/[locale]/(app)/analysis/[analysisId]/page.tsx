import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getAnalysisWithResults } from "@/lib/db/queries/analyses";
import { loadReferenceHealth } from "@/lib/db/queries/references";
import { summariseHealth } from "@/lib/domain/reference";
import { AnalysisReport } from "@/components/analysis/AnalysisReport";

/**
 * Report overview.
 *
 * Server-renders the snapshot that exists right now — a half-done analysis
 * shows its finished checks immediately, never a full-page spinner — then hands
 * off to the client `AnalysisReport`, which owns the live subscription.
 *
 * The read goes through P1's `getAnalysisWithResults`, which selects only
 * client-safe columns and joins `checks_public` + `findings`; it can never
 * transitively pull `analysis_prompt`. RLS scopes it, so another user's id
 * resolves to null → not-found.
 */
export default async function AnalysisOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; analysisId: string }>;
}) {
  const { locale, analysisId } = await params;
  setRequestLocale(locale);

  const db = await createClient();
  const analysis = await getAnalysisWithResults(db, analysisId);

  if (!analysis) {
    notFound();
  }

  // Reference-health counts for the overview card come from the SAME reference
  // rows the References tab renders — one source of truth, not a second summary.
  let referenceCounts: {
    verified: number;
    needsCorrection: number;
    broken: number;
    notFound: number;
  } | null = null;

  if (analysis.reference_health_status !== "NONE") {
    const snapshot = await loadReferenceHealth(db, analysisId);
    const summary = summariseHealth(snapshot.bibliography, snapshot.pairs);
    referenceCounts = {
      verified: summary.verified,
      needsCorrection: summary.needsCorrection,
      broken: summary.brokenUrl,
      notFound: summary.notFound,
    };
  }

  return (
    <AnalysisReport
      analysisId={analysisId}
      initialData={analysis}
      referenceCounts={referenceCounts}
    />
  );
}
