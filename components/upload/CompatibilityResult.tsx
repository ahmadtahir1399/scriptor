"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { IconAlert, IconCheck } from "@/components/icons";

import { useFadeRise } from "@/lib/hooks/useReducedMotion";
import type { PageType } from "@/lib/db/enums";
import type { PaperUpload } from "@/lib/domain/paper";
import type { IncompatibilityReason } from "@/lib/ingestion/compatibility";
import { ButtonLink } from "@/components/ui/button-link";
import { SectionCard } from "@/components/shared/SectionCard";
import { DocumentStatsRow } from "@/components/upload/DocumentStatsRow";
import { StartAnalysisButton } from "@/components/upload/StartAnalysisButton";

export interface CompatibilityResultProps {
  upload: PaperUpload;
  sectionCounts: Partial<Record<PageType, number>>;
}

/**
 * The verdict.
 *
 * Never a generic failure. Each rejection reason maps to a specific heading
 * and a specific fix — a student told only "this file did not work" has no way
 * forward, and the most common rejection (a scanned PDF) has a concrete
 * remedy they can act on in ten minutes.
 */
export function CompatibilityResult({
  upload,
  sectionCounts,
}: CompatibilityResultProps) {
  const t = useTranslations("upload");
  const fadeRise = useFadeRise();

  const isCompatible = upload.is_compatible === true;

  return (
    <motion.div
      initial={fadeRise.initial}
      animate={fadeRise.animate}
      transition={fadeRise.transition}
    >
      {isCompatible ? (
        <SectionCard className="border-verified/30">
          <div className="flex items-start gap-3">
            <div className="bg-verified-soft flex size-10 shrink-0 items-center justify-center rounded-full">
              <IconCheck className="text-verified size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-section-title text-ink">{t("ready.title")}</p>
              <p className="text-body text-muted mt-1">
                {t("ready.description")}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <DocumentStatsRow upload={upload} sectionCounts={sectionCounts} />
          </div>

          <div className="mt-6">
            {/* P4 enables this. The engine fans nine checks across the queue. */}
            <StartAnalysisButton uploadId={upload.id} />
          </div>
        </SectionCard>
      ) : (
        <IncompatibleCard reason={upload.incompatibility_reason} />
      )}
    </motion.div>
  );
}

function IncompatibleCard({ reason }: { reason: string | null }) {
  const t = useTranslations("upload");

  // Fall back to UNREADABLE for an unrecognised code rather than rendering a
  // missing translation key at the student.
  const key = (reason ?? "UNREADABLE") as IncompatibilityReason;

  return (
    <SectionCard className="border-warning/30">
      <div className="flex items-start gap-3">
        <div className="bg-warning-soft flex size-10 shrink-0 items-center justify-center rounded-full">
          <IconAlert
            className="text-warning size-5"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-section-title text-ink">
            {t(`incompatible.${key}.title`)}
          </p>
          <p className="text-body text-muted mt-1">
            {t(`incompatible.${key}.fix`)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/upload">
          {t("incompatible.uploadDifferent")}
        </ButtonLink>
        <ButtonLink href="/settings" variant="ghost">
          {t("incompatible.contactSupport")}
        </ButtonLink>
      </div>
    </SectionCard>
  );
}
