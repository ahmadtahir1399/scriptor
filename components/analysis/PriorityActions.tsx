"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { IconArrowRight } from "@/components/icons";

import type { AppLocale } from "@/lib/db/enums";
import type { PriorityAction } from "@/lib/analysis/presentation";
import { checkName, type PublicCheck } from "@/lib/domain/check";
import { Link } from "@/i18n/routing";

/**
 * The "if you only do three things" strip.
 *
 * Up to three chips summarising what most needs fixing, each linking to the
 * relevant check card. Hidden while the analysis is still generating — a
 * half-formed priority list is worse than none. Each chip names the check and
 * its finding count, so the student can triage at a glance.
 */
export interface PriorityActionsProps {
  actions: readonly PriorityAction[];
  /** For resolving a check code to its localised name. */
  checksByCode: ReadonlyMap<string, PublicCheck>;
}

export function PriorityActions({
  actions,
  checksByCode,
}: PriorityActionsProps) {
  const t = useTranslations("analysis");
  const locale = useLocale().toUpperCase() as AppLocale;

  if (actions.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-micro text-muted mb-2 uppercase">
        {t("priority.title")}
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const check = checksByCode.get(action.checkCode);
          const name = check ? checkName(check, locale) : action.checkCode;

          return (
            <Link
              key={action.checkCode}
              href={action.href}
              className="border-border bg-surface hover:border-primary hover:bg-primary-soft group flex items-center gap-2 rounded-md border px-3 py-2 text-body transition-colors"
            >
              <span className="text-ink font-medium">{name}</span>
              <span className="text-meta text-muted">
                {action.count > 0
                  ? t("priority.findings", { count: action.count })
                  : t("priority.review")}
              </span>
              <IconArrowRight
                className="text-muted group-hover:text-primary size-3.5"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
