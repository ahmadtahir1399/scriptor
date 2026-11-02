"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconSignOut } from "@/components/icons";

import { useRouter } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import { signOut } from "@/lib/auth/actions";
import { signOutEverywhere } from "@/lib/settings/actions";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

/**
 * Session controls: sign out of this device, or revoke every session
 * everywhere. The latter is global-scope on the server, so a stolen or stale
 * session on another device is cut off immediately.
 */
export function SessionSection() {
  const t = useTranslations("settings.session");
  const router = useRouter();

  const onSignOutEverywhere = async (): Promise<void> => {
    await signOutEverywhere();
    router.push(ROUTES.signIn);
    router.refresh();
  };

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-wrap items-center gap-3">
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <IconSignOut aria-hidden="true" />
            {t("signOut")}
          </Button>
        </form>

        <ConfirmDialog
          title={t("everywhereTitle")}
          description={t("everywhereDescription")}
          confirmLabel={t("everywhereConfirm")}
          onConfirm={onSignOutEverywhere}
          trigger={<Button variant="ghost">{t("signOutEverywhere")}</Button>}
        />
      </div>
    </SectionCard>
  );
}
