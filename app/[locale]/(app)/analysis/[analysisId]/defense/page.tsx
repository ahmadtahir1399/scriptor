import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSessionUser } from "@/lib/auth/session";
import { getDefenseData } from "@/lib/defense/actions";
import { DefenseView } from "@/components/defense/DefenseView";

/**
 * Defense tab — predicted questions and practice history.
 *
 * Server-renders the current state; the client view owns the live subscription
 * so questions appear the moment generation finishes. Ownership is enforced by
 * `getDefenseData` (RLS-scoped) — a foreign analysis id resolves to null →
 * not-found. The header comes from the shared analysis layout.
 */
export default async function DefensePage({
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

  const data = await getDefenseData(analysisId);
  if (!data) {
    notFound();
  }

  return (
    <DefenseView analysisId={analysisId} userId={user.id} initial={data} />
  );
}
