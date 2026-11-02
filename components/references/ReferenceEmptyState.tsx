"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconFileQuestion, IconLink } from "@/components/icons";

import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Honest empty states for the References page.
 *
 * A document with no bibliography pages gets a plain "we couldn't find a
 * reference section" — never a fabricated result. A document where the feature
 * was never requested gets the calm "not run" message instead.
 */
export interface ReferenceEmptyStateProps {
  reason: "no_bibliography" | "not_requested";
}

export function ReferenceEmptyState({ reason }: ReferenceEmptyStateProps) {
  const t = useTranslations("analysis.references");

  if (reason === "not_requested") {
    return (
      <EmptyState
        icon={IconLink}
        title={t("empty.notRequestedTitle")}
        description={t("notRun")}
      />
    );
  }

  return (
    <EmptyState
      icon={IconFileQuestion}
      title={t("empty.noBibliographyTitle")}
      description={t("empty.noBibliographyDescription")}
    />
  );
}
