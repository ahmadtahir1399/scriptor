"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { JobStatus } from "@/lib/db/enums";
import type { ReferenceHealthSummary } from "@/lib/domain/reference";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/**
 * The summary strip at the top of the References page.
 *
 * Four counters — verified / needs correction / broken+not-found / unchecked —
 * plus a reconciliation-issues chip. While verification is running it shows a
 * live "Verified N of M sources" count and a thin progress bar, never a blank
 * spinner: extraction is already done, so there is always real state to show.
 */
export interface ReferenceSummaryStripProps {
  summary: ReferenceHealthSummary;
  status: JobStatus;
}

export function ReferenceSummaryStrip({
  summary,
  status,
}: ReferenceSummaryStripProps) {
  const t = useTranslations("analysis.references");

  const broken = summary.brokenUrl + summary.notFound;
  const reconciliationIssues = summary.missingEntries + summary.uncitedEntries;
  const verifiedish = summary.verified + summary.needsCorrection + broken;
  const isVerifying = status === "GENERATING";
  const percent =
    summary.total === 0 ? 0 : Math.round((verifiedish / summary.total) * 100);

  const counters = [
    { label: t("verified"), value: summary.verified, tone: "text-verified" },
    {
      label: t("needsCorrection"),
      value: summary.needsCorrection,
      tone: "text-warning",
    },
    { label: t("brokenNotFound"), value: broken, tone: "text-critical" },
    { label: t("unchecked"), value: summary.unchecked, tone: "text-muted" },
  ];

  return (
    <SectionCard>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            {counters.map((counter) => (
              <div key={counter.label}>
                <dt className="text-micro text-muted uppercase">
                  {counter.label}
                </dt>
                <dd
                  className={`text-page-title mt-1 tabular-nums ${counter.tone}`}
                >
                  {counter.value}
                </dd>
              </div>
            ))}
          </dl>

          <Badge
            variant={reconciliationIssues > 0 ? "warning" : "outline"}
            className="shrink-0"
          >
            {t("reconciliationIssues", { count: reconciliationIssues })}
          </Badge>
        </div>

        {isVerifying ? (
          <div className="space-y-2">
            <p className="text-meta text-muted">
              {t("verifyingProgress", {
                done: verifiedish,
                total: summary.total,
              })}
            </p>
            <Progress value={percent} className="h-1" />
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
