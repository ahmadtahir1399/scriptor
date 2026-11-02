import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getPaperDetail } from "@/lib/papers/actions";
import { PaperDetailContent } from "@/components/papers/PaperDetailContent";

/**
 * Paper detail + version history.
 *
 * `getPaperDetail` is RLS- and ownership-scoped: a foreign or unknown paper id
 * resolves to null and renders `not-found.tsx`, never a permission error that
 * would confirm the paper exists. First paint is server-rendered; the client
 * boundary keeps in-progress versions live.
 */
export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ locale: string; paperId: string }>;
}) {
  const { locale, paperId } = await params;
  setRequestLocale(locale);

  const detail = await getPaperDetail(paperId);
  if (!detail) {
    notFound();
  }

  return <PaperDetailContent paperId={paperId} initial={detail} />;
}
