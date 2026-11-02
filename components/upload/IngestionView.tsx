"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";

import type { PageType } from "@/lib/db/enums";
import type { PaperUpload } from "@/lib/domain/paper";
import { retryIngestion } from "@/lib/upload/actions";
import { useIngestionProgress } from "@/hooks/useIngestionProgress";
import { ErrorState } from "@/components/shared/ErrorState";
import { SectionCard } from "@/components/shared/SectionCard";
import { IngestionStageList } from "@/components/upload/IngestionStageList";
import { CompatibilityResult } from "@/components/upload/CompatibilityResult";

export interface IngestionViewProps {
  upload: PaperUpload;
  sectionCounts: Partial<Record<PageType, number>>;
}

/**
 * Live ingestion view.
 *
 * The verdict is read from the server-rendered upload row when it is already
 * decided; otherwise the stage list runs until `isComplete`, then refreshes so
 * the server re-reads the now-populated verdict.
 */
export function IngestionView({ upload, sectionCounts }: IngestionViewProps) {
  const t = useTranslations("errors");
  const queryClient = useQueryClient();
  const progress = useIngestionProgress(upload.id);

  const [isRetrying, setIsRetrying] = React.useState(false);

  const verdictDecided = upload.is_compatible !== null;

  // Once the pipeline finishes, the server component still holds the pre-verdict
  // row. A one-shot refresh pulls the decided one without polling forever.
  React.useEffect(() => {
    if (progress.isComplete && !verdictDecided) {
      const timer = setTimeout(() => window.location.reload(), 600);
      return () => clearTimeout(timer);
    }
  }, [progress.isComplete, verdictDecided]);

  const onRetry = async () => {
    setIsRetrying(true);
    try {
      await retryIngestion({ uploadId: upload.id });
      await queryClient.invalidateQueries({
        queryKey: ["ingestion-jobs", upload.id],
      });
    } finally {
      setIsRetrying(false);
    }
  };

  if (progress.hasFailed && !verdictDecided) {
    return (
      <SectionCard padded={false}>
        <ErrorState
          title={t("genericTitle")}
          description={t("genericDescription")}
          onRetry={() => void onRetry()}
          retryLabel={isRetrying ? t("retrying") : undefined}
        />
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <IngestionStageList
        stages={progress.stages}
        isComplete={progress.isComplete}
      />

      {verdictDecided ? (
        <CompatibilityResult upload={upload} sectionCounts={sectionCounts} />
      ) : null}
    </div>
  );
}
