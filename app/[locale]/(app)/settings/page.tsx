import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import { getSessionUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/actions";
import { PageHeader } from "@/components/shared/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { AnalysisDefaultsSection } from "@/components/settings/AnalysisDefaultsSection";
import { NotificationPrefsSection } from "@/components/settings/NotificationPrefsSection";
import { SessionSection } from "@/components/settings/SessionSection";

/**
 * Settings — profile, analysis defaults, notifications, session. RLS-scoped: a
 * user only ever reads and writes their own settings.
 */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect({ href: `${ROUTES.signIn}?next=/settings`, locale });
    return null;
  }

  const settings = await getSettings();
  if (!settings) {
    redirect({ href: `${ROUTES.signIn}?next=/settings`, locale });
    return null;
  }

  const t = await getTranslations("settings");

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsNav />

      <div className="flex max-w-3xl flex-col gap-6">
        <ProfileSection profile={settings.profile} />
        <AnalysisDefaultsSection
          applyCustomChecks={settings.profile.apply_custom_checks_by_default}
          defaultAutoDelete={settings.profile.default_auto_delete}
        />
        {settings.preferences ? (
          <NotificationPrefsSection preferences={settings.preferences} />
        ) : null}
        <SessionSection />
      </div>
    </div>
  );
}
