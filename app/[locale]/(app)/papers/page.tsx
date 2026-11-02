import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import { getSessionUser } from "@/lib/auth/session";
import { getPapersLibrary } from "@/lib/papers/actions";
import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaperGrid } from "@/components/papers/PaperGrid";

/**
 * Papers library — the post-sign-in landing and the home base.
 *
 * Server-rendered on first paint, so a returning student sees their papers
 * instantly rather than a spinner. The grid is a thin client boundary that owns
 * the Realtime subscription for any in-progress analyses. Every read is
 * RLS-scoped, so the library can only ever contain the caller's own papers.
 */
export default async function PapersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect({ href: `${ROUTES.signIn}?next=/papers`, locale });
    return null;
  }

  const t = await getTranslations("papers");
  const papers = await getPapersLibrary();

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<ButtonLink href="/upload">{t("newAnalysis")}</ButtonLink>}
      />

      <PaperGrid initial={papers} userId={user.id} />
    </div>
  );
}
