"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconArrowRight } from "@/components/icons";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { severityTone, type DisplayFinding } from "@/lib/analysis/presentation";
import type { ScoreTone } from "@/lib/analysis/presentation";

/**
 * One finding inside an expanded check card.
 *
 * The verbatim quote renders in serif on a faint highlight — the student's own
 * words, shown back to them exactly. Below it: what's wrong, the suggested fix,
 * the page, and a "View in document" deep-link into P7 (by finding id where the
 * finding is a real row, by page otherwise).
 */
export interface CheckFindingItemProps {
  finding: DisplayFinding;
}

const SEVERITY_DOT: Record<ScoreTone, string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  verified: "bg-verified",
  muted: "bg-muted",
};

export function CheckFindingItem({ finding }: CheckFindingItemProps) {
  const t = useTranslations("analysis.finding");
  const tone = severityTone(finding.severity);

  return (
    <li className="border-border border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn("size-1.5 rounded-full", SEVERITY_DOT[tone])}
          aria-hidden="true"
        />
        <span className="text-micro text-muted uppercase">
          {t(`severity.${finding.severity}`)}
        </span>
        {finding.pageNumber !== null ? (
          <span className="text-micro text-muted">
            · {t("page", { page: finding.pageNumber })}
          </span>
        ) : null}
      </div>

      <blockquote className="border-highlight/60 bg-highlight/40 text-highlight-foreground rounded-sm border-l-2 px-3 py-2 prose-thesis">
        {finding.quote}
      </blockquote>

      {finding.description ? (
        <p className="text-body text-ink mt-3">{finding.description}</p>
      ) : null}

      {finding.suggestion ? (
        <p className="text-body text-muted mt-2">
          <span className="text-ink font-medium">{t("suggestion")}: </span>
          {finding.suggestion}
        </p>
      ) : null}

      {finding.href ? (
        <Link
          href={finding.href}
          className="text-primary hover:text-primary/80 mt-3 inline-flex items-center gap-1 text-meta font-medium"
        >
          {t("viewInDocument")}
          <IconArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </li>
  );
}
