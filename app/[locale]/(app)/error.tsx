"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/shared/ErrorState";
import { SectionCard } from "@/components/shared/SectionCard";

/**
 * Error boundary for every authenticated page.
 *
 * Must be a client component and must accept exactly this prop shape — Next
 * supplies `error` and `reset`. Later route segments that need bespoke
 * recovery copy add their own `error.tsx`; everything else inherits this.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  React.useEffect(() => {
    // Surfaced in the server logs / error reporter. The user sees the digest.
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
