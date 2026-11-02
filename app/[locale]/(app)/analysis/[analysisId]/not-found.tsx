import * as React from "react";
import { getTranslations } from "next-intl/server";
import { IconFileQuestion } from "@/components/icons";

import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionCard } from "@/components/shared/SectionCard";

/**
 * Analysis not found or not owned.
 *
 * Calm and deliberately indistinguishable between "doesn't exist" and "isn't
 * yours" — the RLS-scoped query returns null for both, so this page never
 * confirms whether an id belongs to someone else.
 */
export default async function AnalysisNotFound() {
  const t = await getTranslations("analysis.notFound");

  return (
    <SectionCard padded={false}>
      <EmptyState
        icon={IconFileQuestion}
        title={t("title")}
        description={t("description")}
        action={<ButtonLink href="/papers">{t("backToPapers")}</ButtonLink>}
      />
    </SectionCard>
  );
}
