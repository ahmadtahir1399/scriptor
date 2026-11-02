"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface PrivacyOptionsValue {
  autoDelete: boolean;
  sendEmailResults: boolean;
}

export interface PrivacyOptionsProps {
  value: PrivacyOptionsValue;
  onChange: (value: PrivacyOptionsValue) => void;
  disabled?: boolean;
}

/**
 * Privacy choices.
 *
 * Both default to the private option. Auto-delete defaults ON: a student's
 * unpublished thesis should not sit on our servers indefinitely because they
 * did not notice a checkbox.
 */
export function PrivacyOptions({
  value,
  onChange,
  disabled,
}: PrivacyOptionsProps) {
  const t = useTranslations("upload.privacy");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="auto-delete"
          checked={value.autoDelete}
          onCheckedChange={(checked) =>
            onChange({ ...value, autoDelete: checked === true })
          }
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <Label htmlFor="auto-delete" className="cursor-pointer">
            {t("autoDelete")}
          </Label>
          <p className="text-meta text-muted mt-0.5">{t("autoDeleteHint")}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="email-results"
          checked={value.sendEmailResults}
          onCheckedChange={(checked) =>
            onChange({ ...value, sendEmailResults: checked === true })
          }
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <Label htmlFor="email-results" className="cursor-pointer">
            {t("emailResults")}
          </Label>
          <p className="text-meta text-muted mt-0.5">{t("emailResultsHint")}</p>
        </div>
      </div>
    </div>
  );
}
