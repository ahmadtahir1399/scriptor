"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { IconClose, IconPencil, IconRefresh } from "@/components/icons";

import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import type { PaperDetailView } from "@/lib/papers/presentation";
import { usePaperDetail } from "@/hooks/usePaperDetail";
import { reanalyseCurrentVersion } from "@/lib/papers/actions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { UploadNewVersionButton } from "@/components/papers/UploadNewVersionButton";
import { VersionScoreTrend } from "@/components/papers/VersionScoreTrend";
import { VersionList } from "@/components/papers/VersionList";
import { RenamePaperDialog } from "@/components/papers/RenamePaperDialog";
import { DeletePaperDialog } from "@/components/papers/DeletePaperDialog";

/**
 * The paper-detail client boundary.
 *
 * Owns the Realtime subscription (via `usePaperDetail`) and the header actions —
 * upload a new version, re-analyse the current one, rename, delete. Re-analyse
 * is optimistic: it invalidates the live query, the current version's row flips
 * to GENERATING, and Realtime streams it to its new score. All actions are
 * ownership-checked server-side.
 */
export interface PaperDetailContentProps {
  paperId: string;
  initial: PaperDetailView;
}

function formatDocType(code: string | null): string | undefined {
  if (!code) return undefined;
  return code
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function PaperDetailContent({
  paperId,
  initial,
}: PaperDetailContentProps) {
  const t = useTranslations("papers");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { detail } = usePaperDetail(paperId, initial);

  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isReanalysing, startReanalyse] = React.useTransition();

  const currentRunning = detail.versions.some(
    (v) => v.isCurrent && v.status === "GENERATING",
  );

  const onReanalyse = (): void => {
    startReanalyse(async () => {
      const result = await reanalyseCurrentVersion({ paperId });
      if (result.ok) {
        await queryClient.invalidateQueries({
          queryKey: ["paper-detail", paperId],
        });
      }
    });
  };

  const actions = (
    <div className="flex items-center gap-2">
      <UploadNewVersionButton paperId={paperId} size="sm" />
      <Button
        variant="outline"
        size="sm"
        onClick={onReanalyse}
        disabled={isReanalysing || currentRunning}
      >
        <IconRefresh
          className={cn(isReanalysing && "animate-spin")}
          aria-hidden="true"
        />
        {t("actions.reanalyseCurrent")}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("actions.rename")}
        onClick={() => setRenameOpen(true)}
      >
        <IconPencil aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("actions.delete")}
        className="text-critical"
        onClick={() => setDeleteOpen(true)}
      >
        <IconClose aria-hidden="true" />
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={detail.title || t("untitled")}
        description={formatDocType(detail.documentTypeCode)}
        actions={actions}
      />

      {/*
       * Trend beside the version list from `lg`, rather than a full-width
       * chart with the list pushed below the fold.
       *
       * The split is 2:3 deliberately. The trend is a fixed-size chart and a
       * short caption — given half the width it sat in a large empty card —
       * while the version list is the working surface of this page and wants
       * the room. `minmax(0,…)` on both tracks because a bare `2fr` has an
       * automatic minimum, and the chart's SVG would then push its column
       * past the viewport and scroll the whole page sideways.
       *
       * `items-start` so the shorter card keeps its natural height instead of
       * stretching into a mostly-empty box.
       */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VersionScoreTrend
          trend={detail.trend}
          currentDelta={detail.currentDelta}
        />
        <VersionList versions={detail.versions} paperId={paperId} />
      </div>

      <RenamePaperDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        paperId={paperId}
        currentTitle={detail.title}
      />
      <DeletePaperDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        paperId={paperId}
        title={detail.title || t("untitled")}
        onDeleted={() => router.push("/papers")}
      />
    </div>
  );
}
