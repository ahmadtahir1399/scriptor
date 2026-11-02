"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { setRetention } from "@/lib/settings/actions";
import { RETENTION_DAYS } from "@/lib/retention/config";
import { SectionCard } from "@/components/shared/SectionCard";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

/**
 * The account-wide auto-delete choice. Setting it writes the default AND brings
 * existing uploads into line, so the retention promise is retroactive. The card
 * states precisely what a purge removes (the file + raw text) and what it keeps
 * (the report), which is the whole privacy story in one place.
 */
export interface RetentionCardProps {
  autoDelete: boolean;
}

export function RetentionCard({ autoDelete }: RetentionCardProps) {
  const t = useTranslations("settings.retention");
  const [mode, setMode] = React.useState(autoDelete ? "delete" : "keep");
  const [isPending, startTransition] = React.useTransition();

  const onChange = (value: string): void => {
    const previous = mode;
    setMode(value);
    startTransition(async () => {
      const result = await setRetention({ autoDelete: value === "delete" });
      if (!result.ok) setMode(previous);
    });
  };

  return (
    <SectionCard
      title={t("title")}
      description={t("description", { days: RETENTION_DAYS })}
    >
      <div className="flex flex-col gap-4">
        <RadioGroup
          value={mode}
          onValueChange={onChange}
          disabled={isPending}
          className="flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem
              value="delete"
              id="retention-delete"
              className="mt-0.5"
            />
            <Label htmlFor="retention-delete" className="font-normal">
              <span className="text-body text-ink block">
                {t("deleteOption", { days: RETENTION_DAYS })}
              </span>
              <span className="text-meta text-muted block">
                {t("deleteOptionHint")}
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem
              value="keep"
              id="retention-keep"
              className="mt-0.5"
            />
            <Label htmlFor="retention-keep" className="font-normal">
              <span className="text-body text-ink block">
                {t("keepOption")}
              </span>
              <span className="text-meta text-muted block">
                {t("keepOptionHint")}
              </span>
            </Label>
          </div>
        </RadioGroup>

        <div className="border-border bg-bg rounded-lg border p-3">
          <p className="text-meta text-ink">{t("whatHappens")}</p>
          <ul className="text-meta text-muted mt-2 space-y-1">
            <li>{t("removes")}</li>
            <li>{t("keeps")}</li>
          </ul>
        </div>

        <p className="text-meta text-muted">{t("perUploadNote")}</p>
      </div>
    </SectionCard>
  );
}
