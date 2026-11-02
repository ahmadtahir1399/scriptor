import { getTranslations, setRequestLocale } from "next-intl/server";

import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/shared/EmptyState";
import { IconCheckCircle } from "@/components/icons";

/**
 * The goodbye page after an account is closed. Deliberately plain and final: the
 * work is done, the account is gone, and the only path forward is out.
 *
 * NOTE: the deletion flow clears the session before landing here, so depending
 * on the auth middleware a signed-out visitor may be routed to sign-in instead —
 * which is a correct end state for a deleted account either way.
 */
export default async function AccountDeletedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("settings.deleted");

  return (
    <div className="py-16">
      <EmptyState
        icon={IconCheckCircle}
        title={t("title")}
        description={t("description")}
        action={<ButtonLink href="/">{t("home")}</ButtonLink>}
      />
    </div>
  );
}
