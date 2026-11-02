"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAi } from "@/components/icons";

import { SectionCard } from "@/components/shared/SectionCard";
import { Progress } from "@/components/ui/progress";

/**
 * The calm "we're reading your guidelines" state while extraction runs. A thin
 * indeterminate bar rather than a bare spinner — the student sees that work is
 * happening, streamed live via Realtime.
 */
export function ExtractionProgress() {
  const t = useTranslations("requirements.extraction");

  return (
    <SectionCard>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <IconAi
            className="text-primary size-4 animate-pulse"
            aria-hidden="true"
          />
          <p className="text-body text-ink">{t("reading")}</p>
        </div>
        <Progress value={null} className="h-1" />
        <p className="text-meta text-muted">{t("readingHint")}</p>
      </div>
    </SectionCard>
  );
}
