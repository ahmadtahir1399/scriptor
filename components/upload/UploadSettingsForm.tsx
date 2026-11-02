"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  APP_LOCALES,
  CITATION_STYLES,
  type AppLocale,
  type SpellingVariant,
} from "@/lib/db/enums";
import {
  CITATION_STYLE_AUTO,
  type CitationStyleChoice,
} from "@/lib/validations/upload";
import type { DocumentType } from "@/lib/domain/paper";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentTypeSelect } from "@/components/upload/DocumentTypeSelect";

/** Spelling variants that belong to each language. */
const SPELLING_BY_LOCALE: Record<AppLocale, SpellingVariant[]> = {
  EN: ["EN_UK", "EN_US"],
  DE: ["DE_DE", "DE_CH"],
};

export interface UploadSettingsValue {
  documentTypeCode: string;
  locale: AppLocale;
  spelling: SpellingVariant;
  citationStyle: CitationStyleChoice;
}

export interface UploadSettingsFormProps {
  documentTypes: DocumentType[];
  value: UploadSettingsValue;
  onChange: (value: UploadSettingsValue) => void;
  disabled?: boolean;
}

export function UploadSettingsForm({
  documentTypes,
  value,
  onChange,
  disabled,
}: UploadSettingsFormProps) {
  const t = useTranslations("upload.settings");

  /**
   * Changing language re-points spelling at that language's default. Leaving
   * EN_US selected under a German document would send every check the wrong
   * orthographic rules, and the zod refinement would reject the submit with an
   * error the student cannot see the cause of.
   */
  const onLocaleChange = (next: string) => {
    const locale = next as AppLocale;
    const options = SPELLING_BY_LOCALE[locale];
    const fallback = options[0];
    if (!fallback) return;

    onChange({
      ...value,
      locale,
      spelling: options.includes(value.spelling) ? value.spelling : fallback,
    });
  };

  const spellingOptions = SPELLING_BY_LOCALE[value.locale];

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <DocumentTypeSelect
          documentTypes={documentTypes}
          value={value.documentTypeCode}
          onValueChange={(code) =>
            onChange({ ...value, documentTypeCode: code })
          }
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="language">{t("language")}</Label>
        <Select
          value={value.locale}
          onValueChange={onLocaleChange}
          disabled={disabled}
        >
          <SelectTrigger id="language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APP_LOCALES.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {t(`locale.${locale}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="spelling">{t("spelling")}</Label>
        <Select
          value={value.spelling}
          onValueChange={(next) =>
            onChange({ ...value, spelling: next as SpellingVariant })
          }
          disabled={disabled}
        >
          <SelectTrigger id="spelling">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {spellingOptions.map((variant) => (
              <SelectItem key={variant} value={variant}>
                {t(`spellingVariant.${variant}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="citation-style">{t("citationStyle")}</Label>
        <Select
          value={value.citationStyle}
          onValueChange={(next) =>
            onChange({ ...value, citationStyle: next as CitationStyleChoice })
          }
          disabled={disabled}
        >
          <SelectTrigger id="citation-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Listed first: it is the honest answer for most students. */}
            <SelectItem value={CITATION_STYLE_AUTO}>
              {t("citationAuto")}
            </SelectItem>
            {CITATION_STYLES.map((style) => (
              <SelectItem key={style} value={style}>
                {t(`citationStyleOption.${style}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
