"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconPlay } from "@/components/icons";

import { useRouter } from "@/i18n/routing";
import { createPractice } from "@/lib/defense/actions";
import { Button } from "@/components/ui/button";

/**
 * Starts a practice session over the analysis's questions and routes into it.
 */
export interface StartPracticeButtonProps {
  analysisId: string;
  disabled?: boolean;
}

export function StartPracticeButton({
  analysisId,
  disabled,
}: StartPracticeButtonProps) {
  const t = useTranslations("defense");
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const onStart = (): void => {
    startTransition(async () => {
      const result = await createPractice({ analysisId });
      if (result.ok)
        router.push(`/analysis/${analysisId}/defense/${result.practiceId}`);
    });
  };

  return (
    <Button onClick={onStart} disabled={isPending || disabled}>
      <IconPlay aria-hidden="true" />
      {isPending ? t("practice.starting") : t("practice.start")}
    </Button>
  );
}
