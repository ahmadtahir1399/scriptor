"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAi } from "@/components/icons";

import type { JobStatus } from "@/lib/db/enums";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusPill } from "@/components/shared/StatusPill";

/**
 * AI-detection surface.
 *
 * Visually distinct from the writing checks and the ONLY place `--color-ai`
 * (violet) is used — the semantic contract reserves violet for the AI signal so
 * it never blurs into the quality feedback. Rendered only when the sub-status
 * is not NONE (i.e. the student asked for it).
 */
export interface AiDetectionCardProps {
  status: JobStatus;
  strongPercent: number | null;
  likelyPercent: number | null;
}

export function AiDetectionCard({
  status,
  strongPercent,
  likelyPercent,
}: AiDetectionCardProps) {
  const t = useTranslations("analysis.ai");

  if (status === "NONE") return null;

  const done = status === "DONE";

  return (
    <SectionCard className="border-ai/30">
      <div className="flex items-start gap-3">
        <div className="bg-ai-soft flex size-9 shrink-0 items-center justify-center rounded-md">
          <IconAi className="text-ai size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body text-ink font-medium">{t("title")}</p>
            <StatusPill status={status} size="sm" />
          </div>

          {done ? (
            <div className="mt-3 flex gap-6">
              <div>
                <p className="text-page-title text-ai tabular-nums">
                  {Math.round(strongPercent ?? 0)}%
                </p>
                <p className="text-micro text-muted uppercase">{t("strong")}</p>
              </div>
              <div>
                <p className="text-page-title text-ai tabular-nums">
                  {Math.round(likelyPercent ?? 0)}%
                </p>
                <p className="text-micro text-muted uppercase">{t("likely")}</p>
              </div>
            </div>
          ) : (
            <p className="text-meta text-muted mt-1">{t("working")}</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
