"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { IconArrowRight, IconHistory } from "@/components/icons";

import type { DefensePractice } from "@/lib/db/queries/defense";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Past practice sessions — date, how many were attempted, whether it was
 * completed, and a link to review. The proof-of-work that turns the unknown
 * viva into something rehearsed.
 */
export interface PracticeHistoryListProps {
  practices: readonly DefensePractice[];
  analysisId: string;
}

export function PracticeHistoryList({
  practices,
  analysisId,
}: PracticeHistoryListProps) {
  const t = useTranslations("defense.history");
  const format = useFormatter();

  if (practices.length === 0) {
    return (
      <EmptyState
        icon={IconHistory}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {practices.map((practice) => (
        <SectionCard key={practice.id}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-body text-ink font-medium">
                {format.dateTime(new Date(practice.started_at), {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="text-meta text-muted mt-0.5">
                {t("attempted", {
                  answered: practice.answered_count,
                  total: practice.question_count,
                })}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={practice.completed_at ? "verified" : "outline"}>
                {practice.completed_at ? t("completed") : t("inProgress")}
              </Badge>
              <ButtonLink
                href={`/analysis/${analysisId}/defense/${practice.id}`}
                variant="outline"
                size="sm"
              >
                {t("review")}
                <IconArrowRight aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
