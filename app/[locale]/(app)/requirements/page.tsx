import { setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import { getSessionUser } from "@/lib/auth/session";
import { getRequirementsLibrary } from "@/lib/requirements/actions";
import { RequirementsLibraryView } from "@/components/requirements/RequirementsLibraryView";

/**
 * Requirements library.
 *
 * Server-rendered on first paint; the client view owns the Realtime
 * subscription for extraction progress. Every read is RLS-scoped, so the
 * library only ever contains the caller's own files and rules.
 */
export default async function RequirementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect({ href: `${ROUTES.signIn}?next=/requirements`, locale });
    return null;
  }

  const library = await getRequirementsLibrary();

  return <RequirementsLibraryView initial={library} userId={user.id} />;
}
