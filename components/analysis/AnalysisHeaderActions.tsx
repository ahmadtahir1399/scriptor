"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconDownload, IconRefresh } from "@/components/icons";

import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import { reanalyseFromAnalysis } from "@/lib/papers/actions";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Report header actions.
 *
 * "Re-analyse" is wired here (P8): it re-runs the upload behind this analysis
 * through P4's engine — a fresh analysis over the same version — then navigates
 * to the new run. Ownership is re-verified server-side. "Download report" is
 * still P14 and stays disabled with a "coming soon" tooltip.
 */
export interface AnalysisHeaderActionsProps {
  analysisId?: string;
}

export function AnalysisHeaderActions({
  analysisId,
}: AnalysisHeaderActionsProps) {
  const t = useTranslations("analysis.actions");
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const onReanalyse = (): void => {
    if (!analysisId) return;
    startTransition(async () => {
      const result = await reanalyseFromAnalysis({ analysisId });
      if (result.ok) router.push(`/analysis/${result.analysisId}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {analysisId ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReanalyse}
          disabled={isPending}
        >
          <IconRefresh
            className={cn(isPending && "animate-spin")}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">{t("reAnalyse")}</span>
        </Button>
      ) : (
        <DisabledAction
          icon={<IconRefresh aria-hidden="true" />}
          label={t("reAnalyse")}
          hint={t("comingSoon")}
        />
      )}
      <DisabledAction
        icon={<IconDownload aria-hidden="true" />}
        label={t("download")}
        hint={t("comingSoon")}
      />
    </div>
  );
}

function DisabledAction({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block">
          <Button variant="ghost" size="sm" disabled>
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="normal-case">{hint}</TooltipContent>
    </Tooltip>
  );
}
