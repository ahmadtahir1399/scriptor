"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconSpinner } from "@/components/icons";
import { toast } from "sonner";

import { useRouter } from "@/i18n/routing";
import { startAnalysis } from "@/lib/analysis/actions";
import { Button } from "@/components/ui/button";

/**
 * The "Start analysis" CTA.
 *
 * On success the checks are fanning out on the queue, and we send the student
 * straight to the report, which renders its own live progress and fills in as
 * results land. Routing to /papers instead — as this did while the report route
 * was still unbuilt — dropped them on a list that shows nothing happening, so
 * a run that was working looked like a run that had silently failed.
 */
export interface StartAnalysisButtonProps {
  uploadId: string;
}

export function StartAnalysisButton({ uploadId }: StartAnalysisButtonProps) {
  const t = useTranslations("analysis");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [started, setStarted] = React.useState(false);

  const onClick = () => {
    startTransition(async () => {
      const result = await startAnalysis(uploadId);

      if (result.ok) {
        setStarted(true);
        toast.success(t("started.toast"));
        router.push(`/analysis/${result.analysisId}`);
        return;
      }

      toast.error(t(`error.${result.error}`));
    });
  };

  return (
    <Button onClick={onClick} disabled={pending || started}>
      {pending ? <IconSpinner className="animate-spin" /> : null}
      {started ? t("started.label") : t("start")}
    </Button>
  );
}
