"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { updateAnalysisDefaults } from "@/lib/settings/actions";
import { useOptimisticToggle } from "@/hooks/useSettings";
import { SectionCard } from "@/components/shared/SectionCard";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Defaults applied to new uploads: whether to pre-select the student's custom
 * requirements, and whether new documents auto-delete after 90 days. Both are
 * optimistic toggles that roll back on failure.
 */
export interface AnalysisDefaultsSectionProps {
  applyCustomChecks: boolean;
  defaultAutoDelete: boolean;
}

export function AnalysisDefaultsSection({
  applyCustomChecks,
  defaultAutoDelete,
}: AnalysisDefaultsSectionProps) {
  const t = useTranslations("settings.defaults");

  const custom = useOptimisticToggle(applyCustomChecks, (value) =>
    updateAnalysisDefaults({ applyCustomChecks: value }),
  );
  const autoDelete = useOptimisticToggle(defaultAutoDelete, (value) =>
    updateAnalysisDefaults({ defaultAutoDelete: value }),
  );

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-4">
        <label className="flex items-start gap-3">
          <Checkbox
            className="mt-0.5"
            checked={custom.value}
            onCheckedChange={(v) => custom.toggle(v === true)}
          />
          <span>
            <span className="text-body text-ink block">{t("applyCustom")}</span>
            <span className="text-meta text-muted block">
              {t("applyCustomHint")}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <Checkbox
            className="mt-0.5"
            checked={autoDelete.value}
            onCheckedChange={(v) => autoDelete.toggle(v === true)}
          />
          <span>
            <span className="text-body text-ink block">{t("autoDelete")}</span>
            <span className="text-meta text-muted block">
              {t("autoDeleteHint")}
            </span>
          </span>
        </label>
      </div>
    </SectionCard>
  );
}
