import { getTranslations, setRequestLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { listDocumentTypes } from "@/lib/db/queries/papers";
import { listPublicChecks } from "@/lib/db/queries/checks";
import { listActiveRequirements } from "@/lib/db/queries/requirements";
import { PageHeader } from "@/components/shared/PageHeader";
import { UploadWizard } from "@/components/upload/UploadWizard";

/**
 * Upload page.
 *
 * Server component: the catalogue reads happen here so the wizard renders with
 * its options already populated. `checks_public` is the view — never `checks`
 * or `check_versions`, which carry the prompt IP.
 */
export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ paperId?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // A `?paperId` marks this as a new version of an existing paper; the wizard
  // passes it through so `prepareUpload` binds to that paper (ownership is
  // re-verified server-side there).
  const paperIdParam = (await searchParams).paperId;
  const paperId = Array.isArray(paperIdParam) ? paperIdParam[0] : paperIdParam;

  const t = await getTranslations("upload");
  const db = await createClient();

  const [documentTypes, checks, requirements] = await Promise.all([
    listDocumentTypes(db),
    listPublicChecks(db),
    listActiveRequirements(db),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <UploadWizard
        documentTypes={documentTypes}
        checks={checks}
        paperId={paperId}
        requirements={requirements}
      />
    </div>
  );
}
