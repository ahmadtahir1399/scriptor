"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/shared/ErrorState";
import { SectionCard } from "@/components/shared/SectionCard";

/**
 * Whole-report error boundary.
 *
 * For a thrown failure while loading the report — distinct from an analysis
 * whose own status is ERROR, which is valid data the report renders itself with
 * its completed checks intact. This only catches the fetch/render throwing.
 */
export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SectionCard padded={false}>
      <ErrorState
        title={t("genericTitle")}
        description={t("genericDescription")}
        onRetry={reset}
        digest={error.digest}
      />
    </SectionCard>
  );
}
