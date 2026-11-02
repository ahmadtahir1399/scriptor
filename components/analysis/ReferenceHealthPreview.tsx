"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconLink } from "@/components/icons";

import type { JobStatus } from "@/lib/db/enums";
import { SectionCard } from "@/components/shared/SectionCard";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Reference-health summary.
 *
 * The card exists now; P9 fills the counts. Until its sub-job runs the card
 * shows a calm "Not run" state rather than nothing, so the slot is visible from
 * day one and P9 drops its numbers in with no layout change.
 */
export interface ReferenceHealthPreviewProps {
  analysisId: string;
  status: JobStatus;
  counts?: {
    verified: number;
    needsCorrection: number;
    broken: number;
    notFound: number;
  } | null;
}

export function ReferenceHealthPreview({
  status,
  counts,
  analysisId,
}: ReferenceHealthPreviewProps) {
  const t = useTranslations("analysis.references");

  // NONE means the student never requested it — show nothing at all.
  if (status === "NONE") return null;

  const stats =
    counts && status === "DONE"
      ? [
          {
            label: t("verified"),
            value: counts.verified,
            tone: "text-verified",
          },
          {
            label: t("needsCorrection"),
            value: counts.needsCorrection,
            tone: "text-warning",
          },
          { label: t("broken"), value: counts.broken, tone: "text-critical" },
          {
            label: t("notFound"),
            value: counts.notFound,
            tone: "text-critical",
          },
        ]
      : null;

  return (
    <SectionCard
      title={t("title")}
      headerAction={
        <ButtonLink
          href={`/analysis/${analysisId}/references`}
          variant="ghost"
          size="sm"
        >
          <IconLink aria-hidden="true" />
          {t("review")}
        </ButtonLink>
      }
    >
      {stats ? (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-micro text-muted uppercase">{stat.label}</dt>
              <dd className={`text-page-title mt-1 tabular-nums ${stat.tone}`}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-body text-muted">{t("notRun")}</p>
      )}
    </SectionCard>
  );
}
