"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAlert, IconRefresh } from "@/components/icons";
import { toast } from "sonner";

import { retryCheck } from "@/lib/analysis/retryCheck";
import { Button } from "@/components/ui/button";

/**
 * The error state for a single check.
 *
 * Amber, never red — one check failing is a hiccup, not a verdict. "Retry this
 * check" re-queues only this check's job and flips the card back to working; the
 * other eight cards never move. This is the failure-isolation invariant made
 * visible to the student.
 */
export interface CheckResultErrorProps {
  checkResultId: string;
  reason: string | null;
}

export function CheckResultError({
  checkResultId,
  reason,
}: CheckResultErrorProps) {
  const t = useTranslations("analysis.checkError");
  const [pending, startTransition] = React.useTransition();

  const onRetry = () => {
    startTransition(async () => {
      const result = await retryCheck({ checkResultId });
      if (result.ok) {
        toast.success(t("retrying"));
      } else {
        toast.error(t("retryFailed"));
      }
    });
  };

  return (
    <div className="flex items-start gap-3">
      <div className="bg-warning-soft flex size-9 shrink-0 items-center justify-center rounded-md">
        <IconAlert className="text-warning size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body text-ink font-medium">{t("title")}</p>
        <p className="text-meta text-muted mt-0.5">
          {reason ?? t("genericReason")}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
          disabled={pending}
        >
          <IconRefresh aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
