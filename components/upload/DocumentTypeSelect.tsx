"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { DocumentType } from "@/lib/domain/paper";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DocumentTypeSelectProps {
  documentTypes: DocumentType[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Document type picker.
 *
 * Shows each type's character ceiling as guidance, because that limit is what
 * the compatibility gate rejects on — a student who picks "Seminar paper" for
 * a 200-page dissertation should see why before uploading, not after.
 */
export function DocumentTypeSelect({
  documentTypes,
  value,
  onValueChange,
  disabled,
}: DocumentTypeSelectProps) {
  const t = useTranslations("upload.settings");

  /*
   * `name_en` unconditionally: the German UI locale was removed, so there is
   * no interface language that would select `name_de`. The column itself
   * stays in the catalogue — the product still analyses German theses, and a
   * German UI could be reinstated by restoring the locale here and in
   * `i18n/routing.ts`.
   */
  const label = (type: DocumentType): string => type.name_en;

  return (
    <div className="grid gap-2">
      <Label htmlFor="document-type">{t("documentType")}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id="document-type">
          <SelectValue placeholder={t("documentTypePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {documentTypes.map((type) => (
            <SelectItem
              key={type.id}
              value={type.code}
              description={t("maxChars", {
                count: Math.round(type.max_chars / 1000),
              })}
            >
              {label(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
