"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconCheckCircle } from "@/components/icons";

import type {
  BibliographyReference,
  ResolvedReferencePair,
} from "@/lib/domain/reference";
import { classifyPair } from "@/lib/domain/reference";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ReconciliationIssue,
  type ReconciliationIssueData,
} from "@/components/references/ReconciliationIssue";

/**
 * The Issues tab — cited-but-missing orphans first (the real problems), then
 * references that need correction, are broken, or could not be found.
 *
 * When there is nothing to act on, a genuinely celebratory empty state: every
 * source checks out. That reassurance IS the product for a careful student.
 */
export interface ReconciliationIssueListProps {
  pairs: readonly ResolvedReferencePair[];
  bibliography: readonly BibliographyReference[];
  analysisId: string;
}

export function ReconciliationIssueList({
  pairs,
  bibliography,
  analysisId,
}: ReconciliationIssueListProps) {
  const t = useTranslations("analysis.references");

  const issues: ReconciliationIssueData[] = React.useMemo(() => {
    const missing: ReconciliationIssueData[] = [];
    for (const pair of pairs) {
      const classified = classifyPair(pair);
      if (classified?.kind === "missing_bibliography") {
        missing.push({
          kind: "missing",
          pairId: pair.id,
          inText: classified.inText,
        });
      }
    }

    const unhealthy: ReconciliationIssueData[] = bibliography
      .filter(
        (ref) =>
          ref.health === "NEEDS_CORRECTION" ||
          ref.health === "BROKEN_URL" ||
          ref.health === "NOT_FOUND",
      )
      .map((reference) => ({ kind: "unhealthy", reference }));

    return [...missing, ...unhealthy];
  }, [pairs, bibliography]);

  if (issues.length === 0) {
    return (
      <EmptyState
        icon={IconCheckCircle}
        title={t("issue.allClearTitle")}
        description={t("issue.allClearDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {issues.map((issue) => (
        <ReconciliationIssue
          key={issue.kind === "missing" ? issue.pairId : issue.reference.id}
          issue={issue}
          analysisId={analysisId}
        />
      ))}
    </div>
  );
}
