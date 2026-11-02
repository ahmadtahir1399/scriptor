"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconFileQuestion } from "@/components/icons";

import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Paper not found — or not owned. Deliberately calm and identical for both
 * cases, so it never confirms whether a paper exists for someone who shouldn't
 * see it. Offers the way back to the library rather than a dead end.
 */
export default function PaperNotFound() {
  const t = useTranslations("papers.notFound");

  return (
    <EmptyState
      icon={IconFileQuestion}
      title={t("title")}
      description={t("description")}
      action={<ButtonLink href="/papers">{t("back")}</ButtonLink>}
    />
  );
}
