"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Feasibility } from "@/lib/todos/schedule";
import { formatMinutes } from "@/lib/todos/schedule";
import { SectionCard } from "@/components/shared/SectionCard";
import { Progress } from "@/components/ui/progress";
import { DeadlinePicker } from "@/components/todos/DeadlinePicker";
import { DeadlineFeasibility } from "@/components/todos/DeadlineFeasibility";

/**
 * The plan's header: overall progress, remaining effort, the deadline chip, and
 * the calm feasibility line (or a gentle nudge to add a submission date).
 */
export interface TodoSummaryBarProps {
  analysisId: string;
  done: number;
  total: number;
  remainingMinutes: number;
  deadline: string | null;
  feasibility: Feasibility;
}

export function TodoSummaryBar({
  analysisId,
  done,
  total,
  remainingMinutes,
  deadline,
  feasibility,
}: TodoSummaryBarProps) {
  const t = useTranslations("todos");
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <SectionCard>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-body text-ink font-medium">
              {t("summary.progress", { done, total })}
            </p>
            <p className="text-meta text-muted mt-0.5">
              {t("summary.effortLeft", {
                effort: formatMinutes(remainingMinutes),
              })}
            </p>
          </div>
          <DeadlinePicker analysisId={analysisId} deadline={deadline} />
        </div>

        <Progress value={percent} className="h-1.5" />

        {deadline ? (
          <DeadlineFeasibility feasibility={feasibility} />
        ) : (
          <p className="text-meta text-muted">{t("summary.addDeadline")}</p>
        )}
      </div>
    </SectionCard>
  );
}
