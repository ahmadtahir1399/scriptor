"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { StageProgress } from "@/hooks/useIngestionProgress";
import { SectionCard } from "@/components/shared/SectionCard";
import { IngestionStageRow } from "@/components/upload/IngestionStageRow";

export interface IngestionStageListProps {
  stages: StageProgress[];
  /** True once the compatibility verdict exists. */
  isComplete: boolean;
}

/**
 * The four-row ingestion list.
 *
 * Three stages come from real jobs; "Preparing analysis" is derived — it has no
 * job of its own in P3 because P4 owns check fan-out. Showing it now keeps the
 * list stable when P4 lands rather than adding a row students have not seen.
 */
export function IngestionStageList({
  stages,
  isComplete,
}: IngestionStageListProps) {
  const t = useTranslations("upload");

  return (
    <SectionCard padded={false}>
      <ul className="px-5">
        {stages.map((stage, index) => (
          <IngestionStageRow key={stage.kind} stage={stage} index={index} />
        ))}

        <IngestionStageRow
          stage={{
            kind: "POST_PROCESSING",
            status: isComplete ? "DONE" : "NONE",
            startedAt: null,
            completedAt: null,
            error: null,
          }}
          index={stages.length}
        />
      </ul>

      <p className="text-meta text-muted border-border border-t px-5 py-4">
        {t("reassurance")}
      </p>
    </SectionCard>
  );
}
