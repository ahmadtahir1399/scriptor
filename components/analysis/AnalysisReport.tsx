"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAlert, IconInfo } from "@/components/icons";

import { useAnalysis } from "@/hooks/useAnalysis";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { useWorkerNudge } from "@/hooks/useWorkerNudge";
import { computeAnalysisScore } from "@/lib/analysis/scoring";
import {
  derivePriorityActions,
  toCheckRatings,
} from "@/lib/analysis/presentation";
import { computeProgress } from "@/lib/domain/analysis";
import type { AnalysisWithResults } from "@/lib/domain/analysis";
import type { PublicCheck } from "@/lib/domain/check";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { IconFileQuestion } from "@/components/icons";
import { AnalysisProgressBar } from "@/components/analysis/AnalysisProgressBar";
import { PriorityActions } from "@/components/analysis/PriorityActions";
import { ScoreHero } from "@/components/analysis/ScoreHero";
import { CheckResultList } from "@/components/analysis/CheckResultList";
import { ReferenceHealthPreview } from "@/components/analysis/ReferenceHealthPreview";
import { AiDetectionCard } from "@/components/analysis/AiDetectionCard";
import { StartAnalysisButton } from "@/components/upload/StartAnalysisButton";

/**
 * The live report — the client boundary that owns the subscription.
 *
 * Server-rendered `initialData` seeds the query so first paint shows whatever
 * was ready; `useAnalysisStream` then keeps it live. The whole component
 * re-derives from the current snapshot on every tick — score, ordering,
 * progress — but the SCORE MATH is never done here: it is delegated to
 * `computeAnalysisScore` from P4, the single source of that truth.
 */
export interface AnalysisReportProps {
  analysisId: string;
  initialData: AnalysisWithResults;
  /** Reference-health counts for the overview card; null when never requested. */
  referenceCounts?: {
    verified: number;
    needsCorrection: number;
    broken: number;
    notFound: number;
  } | null;
}

export function AnalysisReport({
  analysisId,
  initialData,
  referenceCounts,
}: AnalysisReportProps) {
  const t = useTranslations("analysis");
  const { data } = useAnalysis(analysisId, initialData);
  // `data` is typed T | undefined even with initialData; the seed guarantees a
  // value, so fall back to it rather than thread undefined through everything.
  const analysis = data ?? initialData;

  const isTerminal = analysis.status === "DONE" || analysis.status === "ERROR";
  useAnalysisStream(analysisId, isTerminal);

  /*
   * Same backstop as ingestion. A run whose checks are enqueued but whose
   * worker was never woken would otherwise sit at 0% indefinitely in local
   * development, where there is no cron to sweep the queue.
   */
  useWorkerNudge({
    uploadId: analysis.paper_upload_id,
    isPending: !isTerminal,
    progressKey: analysis.check_results
      .map((result) => `${result.id}:${result.status}`)
      .sort()
      .join("|"),
  });

  const results = React.useMemo(
    () =>
      analysis.check_results.filter((result) => !result.hidden_because_ab_test),
    [analysis.check_results],
  );

  const score = React.useMemo(
    () => computeAnalysisScore(toCheckRatings(results)),
    [results],
  );
  const progress = React.useMemo(() => computeProgress(results), [results]);

  const settled = analysis.status === "DONE";
  // Prefer P4's stored overall once settled; fall back to the same pure function.
  const overall = settled
    ? (analysis.overall_score ?? score.overall)
    : score.overall;

  const checksByCode = React.useMemo(() => {
    const map = new Map<string, PublicCheck>();
    for (const result of results) {
      if (result.check?.code) map.set(result.check.code, result.check);
    }
    return map;
  }, [results]);

  const priorityActions = React.useMemo(
    () => (settled ? derivePriorityActions(analysisId, results) : []),
    [settled, analysisId, results],
  );

  const erroredCount = results.filter((r) => r.status === "ERROR").length;
  const isCostCeiling =
    analysis.status === "ERROR" && analysis.error_reason === "COST_CEILING";
  const isAllFailed =
    analysis.status === "ERROR" &&
    analysis.error_reason === "ALL_CHECKS_FAILED";

  // Nothing to show at all yet (freshly started, no result rows).
  if (results.length === 0 && !isTerminal) {
    return (
      <div>
        <AnalysisProgressBar completed={0} total={0} visible />
        <EmptyState
          icon={IconFileQuestion}
          title={t("empty.startingTitle")}
          description={t("empty.startingDescription")}
        />
      </div>
    );
  }

  /*
   * Ingested, but the checks were never run.
   *
   * The analysis row is created at upload time and marked DONE once ingestion
   * finishes, so this is the state of every paper between "we finished reading
   * it" and the student pressing Start. Falling through to the normal report
   * rendered a permanent "Analysing your document…" under an empty score dial —
   * a dead end with no way forward. Offer the action instead.
   */
  if (results.length === 0) {
    return (
      <EmptyState
        icon={IconFileQuestion}
        title={t("empty.notRunTitle")}
        description={t("empty.notRunDescription")}
        action={<StartAnalysisButton uploadId={analysis.paper_upload_id} />}
      />
    );
  }

  return (
    <div>
      <AnalysisProgressBar
        completed={progress.completed + progress.failed}
        total={progress.total}
        visible={!isTerminal && progress.total > 0}
      />

      {/* Partial / error banners — never a red wall; completed work stays shown. */}
      {isCostCeiling ? (
        <Alert variant="info" className="mb-6">
          <IconInfo />
          <div>
            <AlertTitle>
              {t("banner.partialTitle", {
                done: progress.completed,
                total: progress.total,
              })}
            </AlertTitle>
            <AlertDescription>{t("reason.COST_CEILING")}</AlertDescription>
          </div>
        </Alert>
      ) : isAllFailed ? (
        <Alert variant="critical" className="mb-6">
          <IconAlert />
          <div>
            <AlertTitle>{t("banner.allFailedTitle")}</AlertTitle>
            <AlertDescription>{t("reason.ALL_CHECKS_FAILED")}</AlertDescription>
          </div>
        </Alert>
      ) : settled && erroredCount > 0 ? (
        <Alert variant="warning" className="mb-6">
          <IconAlert />
          <AlertDescription>
            {t("banner.someErrored", { count: erroredCount })}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6">
        <ScoreHero
          score={overall}
          categories={score.categories}
          settled={settled}
        />
      </div>

      {priorityActions.length > 0 ? (
        <PriorityActions
          actions={priorityActions}
          checksByCode={checksByCode}
        />
      ) : null}

      <div className="mb-6">
        <CheckResultList results={results} analysisId={analysisId} />
      </div>

      {/*
       * Side by side from `lg`, not stacked. These two are peers — one
       * summarises the bibliography, the other the AI signal — and neither is
       * tall enough to earn a full-width band. Stacking them pushed the AI
       * card a full screen below the reference card for no reason, and left
       * the report ending on two narrow strips of content in a wide column.
       *
       * `items-start` so each keeps its natural height: stretching a short
       * card to match a tall one is what produces a large empty box with a
       * few words floating in the middle of it.
       */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <ReferenceHealthPreview
          analysisId={analysisId}
          status={analysis.reference_health_status}
          counts={referenceCounts}
        />
        <AiDetectionCard
          status={analysis.ai_detection_status}
          strongPercent={analysis.ai_strong_percent}
          likelyPercent={analysis.ai_likely_percent}
        />
      </div>
    </div>
  );
}
