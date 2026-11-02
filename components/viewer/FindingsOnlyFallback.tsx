"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconInfo } from "@/components/icons";

import type { Finding } from "@/lib/domain/analysis";
import { orderFindings } from "@/lib/analysis/presentation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SectionCard } from "@/components/shared/SectionCard";
import { ViewerEmptyState } from "@/components/viewer/ViewerEmptyState";

/**
 * Graceful degradation for DOCX uploads or PDFs whose parse produced no word
 * geometry.
 *
 * Inline highlights are impossible without boxes, but the product still works:
 * every finding is listed with its page and verbatim quote. A calm banner
 * explains the limitation — never a broken canvas.
 */
export interface FindingsOnlyFallbackProps {
  findings: readonly Finding[];
}

export function FindingsOnlyFallback({ findings }: FindingsOnlyFallbackProps) {
  const t = useTranslations("viewer");
  const ordered = orderFindings(findings);

  return (
    <div className="mx-auto max-w-3xl py-6">
      <Alert variant="info" className="mb-6">
        <IconInfo />
        <AlertDescription>{t("fallback.banner")}</AlertDescription>
      </Alert>

      {ordered.length === 0 ? (
        <ViewerEmptyState kind="none" totalCount={0} />
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((finding) => (
            <SectionCard key={finding.id}>
              <div className="flex items-center gap-2">
                <span className="text-micro text-muted uppercase">
                  {t(`sidebar.severity.${finding.severity}`)}
                </span>
                {finding.page_number !== null ? (
                  <span className="text-micro text-muted">
                    · {t("sidebar.page", { page: finding.page_number })}
                  </span>
                ) : null}
              </div>
              <blockquote className="bg-highlight/40 text-highlight-foreground mt-2 rounded-sm px-3 py-2 prose-thesis">
                {finding.quote}
              </blockquote>
              {finding.title ? (
                <p className="text-body text-ink mt-2">{finding.title}</p>
              ) : null}
              {finding.correction ? (
                <p className="text-meta text-muted mt-1">
                  <span className="text-ink font-medium">
                    {t("popover.suggestion")}:{" "}
                  </span>
                  {finding.correction}
                </p>
              ) : null}
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
