"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconFileQuestion } from "@/components/icons";

import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Practice session not found — or not owned. Identical for both, so it never
 * confirms a session exists for someone who shouldn't see it. Links back to the
 * defense questions for this analysis.
 */
export default function PracticeNotFound() {
  const t = useTranslations("defense.notFound");
  const params = useParams();
  const analysisId =
    typeof params.analysisId === "string" ? params.analysisId : "";

  return (
    <EmptyState
      icon={IconFileQuestion}
      title={t("title")}
      description={t("description")}
      action={
        <ButtonLink
          href={analysisId ? `/analysis/${analysisId}/defense` : "/papers"}
        >
          {t("back")}
        </ButtonLink>
      }
    />
  );
}
