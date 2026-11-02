"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconMic } from "@/components/icons";

import { Badge } from "@/components/ui/badge";

/**
 * The deliberately-stubbed voice-practice card.
 *
 * Sets the expectation that a live spoken examiner is coming without building
 * any of it — NO audio capture, upload, or transcription is wired here. It is a
 * static, disabled card by design (see the prompt: voice is a later add-on).
 */
export function VoicePracticeComingSoon() {
  const t = useTranslations("defense.voice");

  return (
    <div className="bg-primary-soft/50 border-primary/20 flex items-center gap-4 rounded-lg border p-5 opacity-90">
      <div className="bg-primary-soft flex size-11 shrink-0 items-center justify-center rounded-full">
        <IconMic className="text-primary size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-body text-ink font-medium">{t("title")}</p>
          <Badge variant="secondary">{t("badge")}</Badge>
        </div>
        <p className="text-meta text-muted mt-0.5">{t("description")}</p>
      </div>
    </div>
  );
}
