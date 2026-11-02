"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/routing";

/**
 * The analysis sub-nav — Overview / Document / References / To-dos / Defense.
 *
 * ── A segmented control, not a tab rule ──────────────────────────────────
 * This used to be a bottom-bordered tab bar, which is the most generic
 * navigation shape there is and fought the capsule language everywhere else in
 * the app. It is now a soft track with a raised pill on the active segment:
 * the pill is the only lifted surface, so "where am I" is answered by
 * elevation rather than by a 2px underline.
 *
 * ── The `enabled` flag is gone, and that was a BUG ───────────────────────
 * Every tab carried an `enabled` boolean from when the later pages were still
 * unbuilt. `document` was never flipped back to `true` — so the PDF viewer,
 * which is the core of this product and has been fully implemented at
 * `/analysis/[id]/document` for a long time, rendered as a greyed-out label
 * with a "Coming soon" tooltip and could not be opened from anywhere in the
 * UI. All five pages exist; the flag and its tooltip are deleted rather than
 * corrected, so this cannot silently happen again.
 */
export interface AnalysisSubNavProps {
  analysisId: string;
  /** Open reference issues — rendered as a live count badge on the tab. */
  referenceIssueCount?: number;
  /** To-do progress — rendered as a live "done/total" badge on the tab. */
  todoProgress?: { done: number; total: number };
  /** Defense question count — rendered as a badge on the tab. */
  defenseCount?: number;
}

type TabKey = "overview" | "document" | "references" | "todos" | "defense";

interface TabDef {
  key: TabKey;
  segment: string;
  badge?: string;
  /** Warm-tinted badge for counts that mean "unresolved". */
  badgeTone?: "attention" | "neutral";
}

export function AnalysisSubNav({
  analysisId,
  referenceIssueCount = 0,
  todoProgress,
  defenseCount = 0,
}: AnalysisSubNavProps) {
  const t = useTranslations("analysis.tabs");
  const pathname = usePathname();

  const base = `/analysis/${analysisId}`;

  const tabs: TabDef[] = [
    { key: "overview", segment: "" },
    { key: "document", segment: "/document" },
    {
      key: "references",
      segment: "/references",
      badge: referenceIssueCount > 0 ? String(referenceIssueCount) : undefined,
      badgeTone: "attention",
    },
    {
      key: "todos",
      segment: "/todos",
      badge:
        todoProgress && todoProgress.total > 0
          ? `${todoProgress.done}/${todoProgress.total}`
          : undefined,
    },
    {
      key: "defense",
      segment: "/defense",
      badge: defenseCount > 0 ? String(defenseCount) : undefined,
    },
  ];

  return (
    <nav
      aria-label={t("label")}
      /* The track scrolls on narrow screens rather than wrapping — a
         segmented control that wraps to two rows stops reading as one control.
         `w-fit` keeps it hugging its contents instead of stretching. */
      className="bg-primary-soft/45 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full p-1"
    >
      {tabs.map((tab) => {
        const href = `${base}${tab.segment}`;
        const isActive =
          tab.segment === "" ? pathname === base : pathname === href;

        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-meta relative inline-flex h-9 items-center gap-2 rounded-full px-4 font-medium whitespace-nowrap",
              "transition-[background-color,color,box-shadow] duration-200 ease-out-quiet",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "bg-surface text-ink shadow-card"
                : "text-muted hover:text-ink",
            )}
          >
            {t(tab.key)}

            {tab.badge ? (
              <span
                className={cn(
                  "text-micro inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-medium tabular-nums",
                  tab.badgeTone === "attention"
                    ? "bg-warning-soft text-warning"
                    : isActive
                      ? "bg-primary-soft text-muted"
                      : "bg-surface/70 text-muted",
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
