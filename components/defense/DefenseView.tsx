"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAi } from "@/components/icons";

import type { DefenseData } from "@/lib/defense/actions";
import { useDefense } from "@/hooks/useDefense";
import { SectionCard } from "@/components/shared/SectionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionGroupList } from "@/components/defense/QuestionGroupList";
import { PracticeHistoryList } from "@/components/defense/PracticeHistoryList";
import { StartPracticeButton } from "@/components/defense/StartPracticeButton";
import { VoicePracticeComingSoon } from "@/components/defense/VoicePracticeComingSoon";
import { DefenseEmptyState } from "@/components/defense/DefenseEmptyState";

/**
 * The defense-prep client boundary. Owns the live subscription and renders the
 * explicit states: generating, not-requested, error, and the ready surface —
 * predicted questions with a prominent "Start practice", plus the stubbed voice
 * card and the practice history.
 */
export interface DefenseViewProps {
  analysisId: string;
  userId: string;
  initial: DefenseData;
}

export function DefenseView({ analysisId, userId, initial }: DefenseViewProps) {
  const t = useTranslations("defense");
  const { data } = useDefense(analysisId, userId, initial);

  if (data.status === "GENERATING") {
    return (
      <SectionCard>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IconAi
              className="text-primary size-4 animate-pulse"
              aria-hidden="true"
            />
            <p className="text-body text-ink">{t("states.generatingTitle")}</p>
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (data.status === "ERROR")
    return <DefenseEmptyState variant="error" analysisId={analysisId} />;
  if (data.status === "NONE")
    return <DefenseEmptyState variant="none" analysisId={analysisId} />;

  const questionCount = data.groups.reduce(
    (sum, group) => sum + group.questions.length,
    0,
  );
  if (questionCount === 0)
    return <DefenseEmptyState variant="none" analysisId={analysisId} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-muted">
          {t("intro", { count: questionCount })}
        </p>
        <StartPracticeButton analysisId={analysisId} />
      </div>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">{t("tabs.questions")}</TabsTrigger>
          <TabsTrigger value="history">
            {t("tabs.history", { count: data.practices.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 flex flex-col gap-4">
          <QuestionGroupList groups={data.groups} />
          <VoicePracticeComingSoon />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <PracticeHistoryList
            practices={data.practices}
            analysisId={analysisId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
