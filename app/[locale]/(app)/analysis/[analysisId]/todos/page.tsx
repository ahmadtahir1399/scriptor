import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getAnalysisReportHeader } from "@/lib/db/queries/analyses";
import { getSessionUser } from "@/lib/auth/session";
import { getTodoData } from "@/lib/todos/actions";
import { TodosView } from "@/components/todos/TodosView";
import { TodosEmptyState } from "@/components/todos/TodosEmptyState";

/**
 * To-dos tab.
 *
 * Server-renders the current plan; the client view owns the live subscription
 * so the list appears the moment generation finishes.
 *
 * ── Why this no longer 404s on a plan-less analysis ──────────────────────
 * `getTodoData` returns null for two very different situations — "this
 * analysis is not yours / does not exist", and anything that leaves it unable
 * to build the payload for an analysis you DO own. Both used to fall into
 * `notFound()`, so clicking the To-dos tab on your own report dead-ended on a
 * 404 page with no way back and no explanation.
 *
 * A 404 has to mean the thing does not exist. The analysis plainly does — the
 * surrounding layout just rendered its header. So ownership is re-checked
 * against that same header: no header means genuinely not-found, a header with
 * no plan means "nothing generated yet", which is a STATE, and
 * `TodosEmptyState` already exists to offer generating one.
 */
export default async function TodosPage({
  params,
}: {
  params: Promise<{ locale: string; analysisId: string }>;
}) {
  const { locale, analysisId } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    notFound();
  }

  const data = await getTodoData(analysisId);

  if (!data) {
    // Only a genuinely missing (or foreign) analysis is a 404. RLS scopes this
    // read, so another user's id resolves to null here exactly as before.
    const db = await createClient();
    const header = await getAnalysisReportHeader(db, analysisId);
    if (!header) {
      notFound();
    }

    return <TodosEmptyState variant="none" analysisId={analysisId} />;
  }

  return <TodosView analysisId={analysisId} userId={user.id} initial={data} />;
}
