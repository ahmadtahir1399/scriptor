"use client";

import * as React from "react";
import type { IconProps } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { IconAlert, IconGraduation } from "@/components/icons";

import { generateDefense } from "@/lib/defense/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * The non-question states: never generated (offer to generate) and generation
 * errored (retry). Generating has its own skeleton in the view.
 */
export interface DefenseEmptyStateProps {
  variant: "none" | "error";
  analysisId: string;
}

const ICON: Record<DefenseEmptyStateProps["variant"], React.ComponentType<IconProps>> = {
  none: IconGraduation,
  error: IconAlert,
};

export function DefenseEmptyState({
  variant,
  analysisId,
}: DefenseEmptyStateProps) {
  const t = useTranslations("defense.states");
  const queryClient = useQueryClient();
  const [isPending, startTransition] = React.useTransition();

  const onGenerate = (): void => {
    startTransition(async () => {
      await generateDefense({ analysisId });
      await queryClient.invalidateQueries({
        queryKey: ["defense", analysisId],
      });
    });
  };

  return (
    <EmptyState
      icon={ICON[variant]}
      title={t(`${variant}.title`)}
      description={t(`${variant}.description`)}
      action={
        <Button onClick={onGenerate} disabled={isPending}>
          {isPending
            ? t("generating")
            : variant === "error"
              ? t("retry")
              : t("generate")}
        </Button>
      }
    />
  );
}
