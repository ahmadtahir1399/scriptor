"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconLibrary } from "@/components/icons";

import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * First-run library state.
 *
 * This is a new student's very first screen after sign-in, so it invites rather
 * than reports emptiness: a clear icon, an encouraging line, and the single
 * action that starts everything.
 */
export function PapersEmptyState() {
  const t = useTranslations("papers");

  return (
    <EmptyState
      icon={IconLibrary}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={<ButtonLink href="/upload">{t("newAnalysis")}</ButtonLink>}
    />
  );
}
