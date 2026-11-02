"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/routing";
import { anonymiseAccountAction } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

/**
 * The softer account-closure path: strips personal information from the account
 * but keeps anonymised aggregate rows. Explained plainly so a student can choose
 * it over permanent deletion when they only want their identity removed.
 */
export function AnonymiseAccountDialog() {
  const t = useTranslations("settings.anonymise");
  const router = useRouter();

  const onConfirm = async (): Promise<void> => {
    await anonymiseAccountAction();
    router.push("/settings/deleted");
  };

  return (
    <ConfirmDialog
      title={t("title")}
      description={t("description")}
      confirmLabel={t("confirm")}
      onConfirm={onConfirm}
      trigger={<Button variant="outline">{t("trigger")}</Button>}
    />
  );
}
