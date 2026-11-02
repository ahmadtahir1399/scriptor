"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconRequirements } from "@/components/icons";

import { EmptyState } from "@/components/shared/EmptyState";

/**
 * First-run requirements state — inviting, not barren. This is where a student
 * turns their faculty's rulebook into checks for the first time.
 */
export interface RequirementsEmptyStateProps {
  action?: React.ReactNode;
}

export function RequirementsEmptyState({
  action,
}: RequirementsEmptyStateProps) {
  const t = useTranslations("requirements");

  return (
    <EmptyState
      icon={IconRequirements}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={action}
    />
  );
}
