import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getGuidelineFileData } from "@/lib/requirements/actions";
import { GuidelineFileView } from "@/components/requirements/GuidelineFileView";

/**
 * One guideline file's extracted requirements.
 *
 * `getGuidelineFileData` is RLS- and ownership-scoped: a foreign or unknown file
 * id resolves to null and renders `not-found.tsx`. First paint is
 * server-rendered; the client view streams extraction progress live.
 */
export default async function GuidelineFilePage({
  params,
}: {
  params: Promise<{ locale: string; fileId: string }>;
}) {
  const { locale, fileId } = await params;
  setRequestLocale(locale);

  const file = await getGuidelineFileData(fileId);
  if (!file) {
    notFound();
  }

  return <GuidelineFileView fileId={fileId} initial={file} />;
}
