"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconClose, IconInbox } from "@/components/icons";

import type { ResolvedReferencePair } from "@/lib/domain/reference";
import { classifyPair } from "@/lib/domain/reference";
import { resolveReferenceIssue } from "@/lib/references/actions";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * The Uncited tab — reference-list entries no citation points at.
 *
 * Softer framing than the Issues tab: an unused reference is a tidiness flag,
 * not a correctness error, so each row is dismissible. Dismiss clears the pair's
 * orphan flag, which drops it from the counts everywhere else.
 */
export interface UncitedListProps {
  pairs: readonly ResolvedReferencePair[];
  analysisId: string;
}

interface UncitedRow {
  pairId: string;
  rawText: string;
}

export function UncitedList({ pairs, analysisId }: UncitedListProps) {
  const t = useTranslations("analysis.references");

  const rows: UncitedRow[] = React.useMemo(() => {
    const out: UncitedRow[] = [];
    for (const pair of pairs) {
      const classified = classifyPair(pair);
      if (classified?.kind === "uncited_bibliography") {
        out.push({
          pairId: pair.id,
          rawText: classified.bibliography.raw_text,
        });
      }
    }
    return out;
  }, [pairs]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={IconInbox}
        title={t("uncited.emptyTitle")}
        description={t("uncited.emptyDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <UncitedItem key={row.pairId} row={row} analysisId={analysisId} />
      ))}
    </div>
  );
}

function UncitedItem({
  row,
  analysisId,
}: {
  row: UncitedRow;
  analysisId: string;
}) {
  const t = useTranslations("analysis.references");
  const [isPending, startTransition] = React.useTransition();
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  const onDismiss = (): void => {
    setDismissed(true);
    startTransition(async () => {
      const result = await resolveReferenceIssue({
        analysisId,
        pairId: row.pairId,
      });
      if (!result.ok) setDismissed(false);
    });
  };

  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p
            className="text-ink text-body"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {row.rawText}
          </p>
          <p className="text-meta text-muted">{t("uncited.hint")}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          disabled={isPending}
          className="shrink-0"
        >
          <IconClose aria-hidden="true" />
          {t("uncited.dismiss")}
        </Button>
      </div>
    </SectionCard>
  );
}
