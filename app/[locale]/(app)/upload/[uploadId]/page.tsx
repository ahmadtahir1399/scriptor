import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import type { PageType } from "@/lib/db/enums";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { assertOwnsUpload } from "@/lib/db/queries/uploads";
import { listPages } from "@/lib/db/queries/papers";
import { PageHeader } from "@/components/shared/PageHeader";
import { IngestionView } from "@/components/upload/IngestionView";

/**
 * Ingestion progress and the compatibility verdict.
 *
 * Ownership is re-verified server-side against the session; the id in the URL
 * is user input. RLS would block a cross-user read anyway, but a 404 here is
 * clearer than an empty page — and it does not confirm that the id exists.
 */
export default async function UploadProgressPage({
  params,
}: {
  params: Promise<{ locale: string; uploadId: string }>;
}) {
  const { locale, uploadId } = await params;
  setRequestLocale(locale);

  // No session in the server component — send them to sign in and back here,
  // rather than a dead-end 404. This is the failure mode when a browser tab is
  // authenticated as a different account than the one that owns the upload, or
  // when the session cookie has gone stale.
  const user = await getSessionUser();
  if (!user) {
    redirect({ href: `${ROUTES.signIn}?next=/upload/${uploadId}`, locale });
    // `redirect` throws, but its return type isn't `never`; this narrows `user`
    // to non-null below and is never actually reached at runtime.
    return null;
  }

  const db = await createClient();

  // Genuinely not owned by this (authenticated) user → a real 404. Distinct
  // from "not signed in" above, so the two cases are no longer conflated.
  let upload;
  try {
    upload = await assertOwnsUpload(db, uploadId, user.id);
  } catch {
    notFound();
  }

  // Section counts for the stats row. Only meaningful once pages exist, and an
  // empty list is the correct answer while PARSE is still running.
  const pages = await listPages(db, upload.id);
  const sectionCounts = pages.reduce<Partial<Record<PageType, number>>>(
    (acc, page) => {
      acc[page.page_type] = (acc[page.page_type] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div>
      <PageHeader
        title={upload.file_name}
        breadcrumbs={[{ label: upload.file_name }]}
      />
      <IngestionView upload={upload} sectionCounts={sectionCounts} />
    </div>
  );
}
