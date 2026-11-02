import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import { getSessionUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/actions";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { RetentionCard } from "@/components/settings/RetentionCard";
import { ExportCard } from "@/components/settings/ExportCard";
import { DangerZone } from "@/components/settings/DangerZone";

/**
 * Your data — retention, export, and account closure. The trust layer: it turns
 * the privacy promises into working controls, and every claim on it reflects
 * real system behaviour (documents aren't used for training or shared).
 */
export default async function DataPrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect({ href: `${ROUTES.signIn}?next=/settings/data`, locale });
    return null;
  }

  const settings = await getSettings();
  if (!settings) {
    redirect({ href: `${ROUTES.signIn}?next=/settings/data`, locale });
    return null;
  }

  const t = await getTranslations("settings");

  return (
    <div>
      <PageHeader title={t("data.title")} description={t("data.subtitle")} />
      <SettingsNav />

      <div className="flex max-w-3xl flex-col gap-6">
        <SectionCard>
          <p className="text-body text-muted">{t("data.privacy")}</p>
        </SectionCard>

        <RetentionCard autoDelete={settings.profile.default_auto_delete} />
        <ExportCard />
        <DangerZone email={settings.profile.email} />
      </div>
    </div>
  );
}
