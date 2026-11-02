import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getAnalysis } from "@/lib/db/queries/analyses";
import { loadReferenceHealth } from "@/lib/db/queries/references";
import { ReferenceTabs } from "@/components/references/ReferenceTabs";
import { ReferenceEmptyState } from "@/components/references/ReferenceEmptyState";

/**
 * References tab.
 *
 * Server-renders the snapshot that exists right now — extracted references and
 * whatever verification has already completed — then hands off to the client
 * `ReferenceTabs`, which owns the live subscription so results stream in as each
 * source resolves.
 *
 * The read is RLS-scoped: another user's analysis id resolves to null →
 * not-found, never a permission error that would confirm the id exists. The
 * header comes from the shared analysis layout; this page does not refetch it.
 */
export default async function ReferencesPage({
  params,
}: {
  params: Promise<{ locale: string; analysisId: string }>;
}) {
  const { locale, analysisId } = await params;
  setRequestLocale(locale);

  const db = await createClient();
  const analysis = await getAnalysis(db, analysisId);
  if (!analysis) {
    notFound();
  }

  const status = analysis.reference_health_status;

  // Never requested — the calm "not run" state, not an empty panel.
  if (status === "NONE") {
    return <ReferenceEmptyState reason="not_requested" />;
  }

  const snapshot = await loadReferenceHealth(db, analysisId);

  // Ran to completion but found no reference section — the honest empty state.
  if (status === "DONE" && snapshot.bibliography.length === 0) {
    return <ReferenceEmptyState reason="no_bibliography" />;
  }

  return (
    <ReferenceTabs analysisId={analysisId} initial={{ status, snapshot }} />
  );
}
