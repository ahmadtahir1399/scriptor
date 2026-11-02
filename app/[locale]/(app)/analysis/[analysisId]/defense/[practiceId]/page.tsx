import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getPracticeData } from "@/lib/defense/actions";
import { PracticeView } from "@/components/defense/PracticeView";

/**
 * One practice session.
 *
 * `getPracticeData` is RLS- and ownership-scoped: a foreign or unknown practice
 * id resolves to null → not-found. Server-rendered so a resumed session shows
 * its prior answers; the client view drives the walk-through from there.
 */
export default async function PracticePage({
  params,
}: {
  params: Promise<{ locale: string; analysisId: string; practiceId: string }>;
}) {
  const { locale, practiceId } = await params;
  setRequestLocale(locale);

  const data = await getPracticeData(practiceId);
  if (!data) {
    notFound();
  }

  return <PracticeView initial={data} />;
}
