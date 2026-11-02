"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { PageType } from "@/lib/db/enums";
import type { PaperUpload } from "@/lib/domain/paper";

export interface DocumentStatsRowProps {
  upload: PaperUpload;
  /** Counts per page type, from the classified pages. */
  sectionCounts: Partial<Record<PageType, number>>;
}

/**
 * Stats for a compatible document.
 *
 * The section breakdown is the reassuring part: it demonstrates the tool
 * actually read the structure rather than just counting pages, which is what
 * makes a student trust the analysis that follows.
 */
export function DocumentStatsRow({
  upload,
  sectionCounts,
}: DocumentStatsRowProps) {
  const t = useTranslations("upload.stats");

  const stats: Array<{ label: string; value: string }> = [
    { label: t("pages"), value: String(upload.page_count ?? 0) },
    { label: t("words"), value: (upload.word_count ?? 0).toLocaleString() },
    {
      label: t("language"),
      value: upload.locale ? t(`locale.${upload.locale}`) : t("unknown"),
    },
    {
      label: t("citationStyle"),
      value: upload.citation_style
        ? t(`citationStyle.${upload.citation_style}`)
        : t("notDetected"),
    },
  ];

  // Ordered as a reader meets them, not by count.
  const sectionOrder: PageType[] = [
    "COVER",
    "ABSTRACT",
    "TOC",
    "BODY",
    "BIBLIOGRAPHY",
    "APPENDIX",
  ];

  const chips = sectionOrder
    .map((type) => ({ type, count: sectionCounts[type] ?? 0 }))
    .filter((entry) => entry.count > 0);

  return (
    <div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-micro text-muted uppercase">{stat.label}</dt>
            <dd className="text-body text-ink mt-1 font-medium">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {chips.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.type}
              className="bg-bg border-border text-meta text-muted rounded-sm border px-2 py-1"
            >
              {chip.count > 1
                ? t(`section.${chip.type}_plural`, { count: chip.count })
                : t(`section.${chip.type}`)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
