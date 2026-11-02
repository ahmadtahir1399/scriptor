"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { IconInfo } from "@/components/icons";

import type { AppLocale } from "@/lib/db/enums";
import {
  checkDescription,
  checkName,
  type PublicCheck,
} from "@/lib/domain/check";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface CheckSelectorProps {
  checks: PublicCheck[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Check selection. All checks are selected by default.
 *
 * At least one must remain selected — an analysis with zero checks produces
 * nothing, so "Clear" leaves the first check on rather than reaching an
 * unsubmittable state the student has to work out how to escape.
 */
export function CheckSelector({
  checks,
  selectedIds,
  onChange,
  disabled,
}: CheckSelectorProps) {
  const t = useTranslations("upload.checks");
  const locale = useLocale().toUpperCase() as AppLocale;

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, id]);
      return;
    }
    const next = selectedIds.filter((selected) => selected !== id);
    if (next.length === 0) return; // Never allow an empty selection.
    onChange(next);
  };

  const selectAll = () => {
    onChange(
      checks.map((check) => check.id).filter((id): id is string => id !== null),
    );
  };

  const clear = () => {
    const first = checks[0]?.id;
    onChange(first ? [first] : []);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-meta text-muted">
          {t("selectedCount", {
            count: selectedIds.length,
            total: checks.length,
          })}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={disabled}
          >
            {t("selectAll")}
          </Button>
          <Button variant="ghost" size="sm" onClick={clear} disabled={disabled}>
            {t("clear")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col">
        {checks.map((check) => {
          if (!check.id) return null;
          const id = check.id;
          const isSelected = selectedIds.includes(id);

          return (
            <div
              key={id}
              className="border-border flex items-start gap-3 border-b py-3 last:border-b-0"
            >
              <Checkbox
                id={`check-${id}`}
                checked={isSelected}
                onCheckedChange={(checked) => toggle(id, checked === true)}
                disabled={disabled}
                className="mt-0.5"
              />

              <div className="min-w-0 flex-1">
                <Label htmlFor={`check-${id}`} className="cursor-pointer">
                  {checkName(check, locale)}
                </Label>
                <p className="text-meta text-muted mt-0.5 line-clamp-1">
                  {checkDescription(check, locale)}
                </p>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted hover:text-ink mt-0.5 shrink-0 transition-colors"
                    aria-label={t("moreInfo")}
                  >
                    <IconInfo className="size-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs normal-case">
                  {checkDescription(check, locale)}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}
