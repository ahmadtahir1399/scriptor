"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { IconLibrary, IconRefresh } from "@/components/icons";

import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/db/enums";
import type { VersionView } from "@/lib/papers/presentation";
import { scoreTone } from "@/lib/analysis/presentation";
import { retryVersionAnalysis } from "@/lib/papers/actions";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { StatusPill } from "@/components/shared/StatusPill";
import { ScoreChip } from "@/components/papers/ScoreChip";

/**
 * One version (draft) in the paper's history.
 *
 * Shows the version number and its score or live status, a category
 * mini-breakdown from `scoring.ts`, and links into the report and document
 * viewer. A version whose analysis errored offers a retry rather than a dead
 * end. "Make current" is deliberately absent — current is always the newest
 * upload, which keeps the model simple.
 */
export interface VersionRowProps {
  version: VersionView;
  paperId: string;
}

const CATEGORY_TONE = {
  verified: "text-verified",
  warning: "text-warning",
  critical: "text-critical",
  muted: "text-muted",
} as const;

export function VersionRow({ version }: VersionRowProps) {
  const t = useTranslations("papers");
  const format = useFormatter();
  const [isPending, startTransition] = React.useTransition();

  const errored = version.status === "ERROR";
  const running = version.status === "GENERATING";

  const onRetry = (): void => {
    if (!version.analysisId) return;
    startTransition(async () => {
      await retryVersionAnalysis({ analysisId: version.analysisId as string });
    });
  };

  return (
    <SectionCard>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-body text-ink font-medium">
              {t("version.number", { n: version.versionNumber })}
            </p>
            {version.isCurrent ? (
              <Badge variant="secondary">{t("version.current")}</Badge>
            ) : null}
          </div>

          <p className="text-meta text-muted">
            {format.relativeTime(new Date(version.uploadedAt))}
            {version.pageCount !== null
              ? ` · ${t("version.pages", { count: version.pageCount })}`
              : ""}
            {version.wordCount !== null
              ? ` · ${t("version.words", { count: version.wordCount })}`
              : ""}
          </p>

          {version.status === "DONE" && version.categories.length > 0 ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-1">
              {version.categories.map((category) => (
                <div
                  key={category.category}
                  className="flex items-center gap-1.5"
                >
                  <dt className="text-micro text-muted uppercase">
                    {t(`category.${category.category}`)}
                  </dt>
                  <dd
                    className={cn(
                      "text-meta tabular-nums",
                      CATEGORY_TONE[scoreTone(category.score)],
                    )}
                  >
                    {category.score === null ? "—" : Math.round(category.score)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          {running || errored ? (
            <StatusPill
              status={(version.status ?? "GENERATING") as JobStatus}
            />
          ) : (
            <ScoreChip score={version.overall} size="lg" />
          )}

          <div className="flex items-center gap-2">
            {errored && version.analysisId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isPending}
              >
                <IconRefresh
                  className={cn(isPending && "animate-spin")}
                  aria-hidden="true"
                />
                {t("version.retry")}
              </Button>
            ) : null}

            {version.analysisId && !errored ? (
              <>
                <ButtonLink
                  href={`/analysis/${version.analysisId}`}
                  variant="outline"
                  size="sm"
                >
                  {t("version.openReport")}
                </ButtonLink>
                <ButtonLink
                  href={`/analysis/${version.analysisId}/document`}
                  variant="ghost"
                  size="sm"
                >
                  <IconLibrary aria-hidden="true" />
                  {t("version.viewDocument")}
                </ButtonLink>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
