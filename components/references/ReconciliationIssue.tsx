"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconArrowRight, IconCheck, IconRefresh } from "@/components/icons";

import { cn } from "@/lib/utils";
import type {
  BibliographyReference,
  InTextReference,
} from "@/lib/domain/reference";
import type { ReferenceHealth } from "@/lib/db/enums";
import {
  recheckReference,
  resolveReferenceIssue,
} from "@/lib/references/actions";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { SectionCard } from "@/components/shared/SectionCard";

/**
 * One reconciliation issue — the highest-value output of the whole feature.
 *
 * Two shapes: a cited-but-missing orphan (a citation with no reference-list
 * entry, the real problem) which deep-links into the document viewer at the
 * citation's word range; and an unhealthy reference (needs-correction / broken /
 * not-found) shown with a concrete fix. Resolving an orphan is optimistic and
 * persisted — it clears the orphan flag, which flows straight into the overview
 * and sub-nav counts.
 */
export type ReconciliationIssueData =
  | { kind: "missing"; pairId: string; inText: InTextReference }
  | { kind: "unhealthy"; reference: BibliographyReference };

export interface ReconciliationIssueProps {
  issue: ReconciliationIssueData;
  analysisId: string;
}

const FIX_KEY: Record<ReferenceHealth, string> = {
  NEEDS_CORRECTION: "issue.needsCorrectionFix",
  BROKEN_URL: "issue.brokenFix",
  NOT_FOUND: "issue.notFoundFix",
  VERIFIED: "issue.notFoundFix",
  UNCHECKED: "issue.notFoundFix",
};

export function ReconciliationIssue({
  issue,
  analysisId,
}: ReconciliationIssueProps) {
  const t = useTranslations("analysis.references");
  const [isPending, startTransition] = React.useTransition();
  const [resolved, setResolved] = React.useState(false);

  if (resolved) return null;

  if (issue.kind === "missing") {
    const { inText, pairId } = issue;

    const onResolve = (): void => {
      setResolved(true); // optimistic — the row disappears immediately
      startTransition(async () => {
        const result = await resolveReferenceIssue({ analysisId, pairId });
        if (!result.ok) setResolved(false); // revert on failure
      });
    };

    return (
      <SectionCard className="border-critical/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-critical text-meta font-medium uppercase">
              {t("issue.missingTitle")}
            </p>
            <p
              className="text-ink text-body"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {inText.raw_text}
            </p>
            <p className="text-meta text-muted">
              {t("issue.missingDescription")}
              {inText.page_number !== null
                ? ` · ${t("issue.page", { page: inText.page_number })}`
                : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {inText.page_number !== null ? (
              <ButtonLink
                href={`/analysis/${analysisId}/document?finding=${inText.id}`}
                variant="outline"
                size="sm"
              >
                {t("issue.viewInDocument")}
                <IconArrowRight aria-hidden="true" />
              </ButtonLink>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={onResolve}
              disabled={isPending}
            >
              <IconCheck aria-hidden="true" />
              {t("issue.markResolved")}
            </Button>
          </div>
        </div>
      </SectionCard>
    );
  }

  const { reference } = issue;

  const onRecheck = (): void => {
    startTransition(async () => {
      await recheckReference({ analysisId, referenceId: reference.id });
    });
  };

  return (
    <SectionCard className="border-warning/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p
            className="text-ink text-body"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {reference.raw_text}
          </p>
          <p className="text-meta text-muted">{t(FIX_KEY[reference.health])}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {reference.resolved_url ? (
            <ButtonLink
              href={reference.resolved_url}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
            >
              {t("openLink")}
            </ButtonLink>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRecheck}
            disabled={isPending}
          >
            <IconRefresh
              className={cn(isPending && "animate-spin")}
              aria-hidden="true"
            />
            {t("recheck")}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
