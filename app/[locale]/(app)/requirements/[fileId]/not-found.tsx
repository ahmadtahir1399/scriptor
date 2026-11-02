"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconFileQuestion } from "@/components/icons";

import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Guideline file not found — or not owned. Identical for both cases so it never
 * confirms a file exists for someone who shouldn't see it. Offers the way back.
 */
export default function GuidelineFileNotFound() {
  const t = useTranslations("requirements.notFound");

  return (
    <EmptyState
      icon={IconFileQuestion}
      title={t("title")}
      description={t("description")}
      action={<ButtonLink href="/requirements">{t("back")}</ButtonLink>}
    />
  );
}
