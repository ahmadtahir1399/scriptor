"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAlert } from "@/components/icons";

import { summariseHealth } from "@/lib/domain/reference";
import {
  useReferenceHealth,
  type ReferenceHealthSeed,
} from "@/hooks/useReferenceHealth";
import { retryVerification } from "@/lib/references/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ReferenceSummaryStrip } from "@/components/references/ReferenceSummaryStrip";
import { ReferenceList } from "@/components/references/ReferenceList";
import { ReconciliationIssueList } from "@/components/references/ReconciliationIssueList";
import { UncitedList } from "@/components/references/UncitedList";

/**
 * The live References surface — the client boundary that owns the subscription.
 *
 * Server-rendered `initial` seeds first paint; `useReferenceHealth` keeps it
 * live as each source resolves. Everything below re-derives from the current
 * snapshot on every tick: the counters, the tab badges, the lists. The score
 * math the other surfaces guard does not apply here — reconciliation and health
 * are already the source of truth.
 */
export interface ReferenceTabsProps {
  analysisId: string;
  initial: ReferenceHealthSeed;
}

export function ReferenceTabs({ analysisId, initial }: ReferenceTabsProps) {
  const t = useTranslations("analysis.references");
  const [isRetrying, startRetry] = React.useTransition();
  const { status, snapshot } = useReferenceHealth(analysisId, initial);

  const summary = React.useMemo(
    () => summariseHealth(snapshot.bibliography, snapshot.pairs),
    [snapshot.bibliography, snapshot.pairs],
  );

  const issueCount =
    summary.missingEntries +
    summary.needsCorrection +
    summary.brokenUrl +
    summary.notFound;
  const uncitedCount = summary.uncitedEntries;

  // Every source unverifiable after the pass finished = providers were down.
  const verificationStalled =
    status === "DONE" &&
    summary.total > 0 &&
    summary.unchecked === summary.total;

  const onRetry = (): void => {
    startRetry(async () => {
      await retryVerification({ analysisId });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <ReferenceSummaryStrip summary={summary} status={status} />

      {verificationStalled ? (
        <Alert variant="warning">
          <IconAlert />
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <AlertDescription>{t("partialDescription")}</AlertDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? t("retrying") : t("retryVerification")}
            </Button>
          </div>
        </Alert>
      ) : null}

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">
            {t("tab.sources", { count: summary.total })}
          </TabsTrigger>
          <TabsTrigger value="issues">
            {t("tab.issues", { count: issueCount })}
          </TabsTrigger>
          <TabsTrigger value="uncited">
            {t("tab.uncited", { count: uncitedCount })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          <ReferenceList
            references={snapshot.bibliography}
            analysisId={analysisId}
          />
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          <ReconciliationIssueList
            pairs={snapshot.pairs}
            bibliography={snapshot.bibliography}
            analysisId={analysisId}
          />
        </TabsContent>

        <TabsContent value="uncited" className="mt-4">
          <UncitedList pairs={snapshot.pairs} analysisId={analysisId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
