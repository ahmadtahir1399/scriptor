"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAi, IconCheckCircle, IconFindings } from "@/components/icons";

import { EmptyState } from "@/components/shared/EmptyState";

/**
 * The sidebar's three empty cases — each a distinct, reassuring message, never
 * a bare "no data". "none" is genuinely good news; "resolved" celebrates it;
 * "filtered" points back at the filter.
 */
export type ViewerEmptyKind = "none" | "resolved" | "filtered";

export interface ViewerEmptyStateProps {
  kind: ViewerEmptyKind;
  totalCount: number;
}

export function ViewerEmptyState({ kind, totalCount }: ViewerEmptyStateProps) {
  const t = useTranslations("viewer.empty");

  if (kind === "resolved") {
    return (
      <EmptyState
        icon={IconCheckCircle}
        title={t("resolvedTitle", { count: totalCount })}
        description={t("resolvedDescription")}
        className="py-10"
      />
    );
  }

  if (kind === "filtered") {
    return (
      <EmptyState
        icon={IconFindings}
        title={t("filteredTitle")}
        description={t("filteredDescription")}
        className="py-10"
      />
    );
  }

  return (
    <EmptyState
      icon={IconAi}
      title={t("noneTitle")}
      description={t("noneDescription")}
      className="py-10"
    />
  );
}
