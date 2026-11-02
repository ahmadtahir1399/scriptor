"use client";

import * as React from "react";
import type { IconProps } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { IconAlert, IconCheckCircle, IconRequirements } from "@/components/icons";

import { generatePlan } from "@/lib/todos/actions";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * The explicit non-plan states.
 *
 *  - none:    the plan was never generated — offer to build it.
 *  - empty:   a strong draft with nothing worth tasking — genuine, not padded.
 *  - allDone: every task ticked off — you're ready.
 *  - error:   generation failed — retry.
 */
export interface TodosEmptyStateProps {
  variant: "none" | "empty" | "allDone" | "error";
  analysisId: string;
}

const ICON: Record<TodosEmptyStateProps["variant"], React.ComponentType<IconProps>> = {
  none: IconRequirements,
  empty: IconCheckCircle,
  allDone: IconCheckCircle,
  error: IconAlert,
};

export function TodosEmptyState({ variant, analysisId }: TodosEmptyStateProps) {
  const t = useTranslations("todos.states");
  const queryClient = useQueryClient();
  const [isPending, startTransition] = React.useTransition();

  const onGenerate = (): void => {
    startTransition(async () => {
      await generatePlan({ analysisId });
      await queryClient.invalidateQueries({ queryKey: ["todos", analysisId] });
    });
  };

  const action =
    variant === "none" ? (
      <Button onClick={onGenerate} disabled={isPending}>
        {isPending ? t("generating") : t("generate")}
      </Button>
    ) : variant === "error" ? (
      <Button onClick={onGenerate} disabled={isPending}>
        {t("retry")}
      </Button>
    ) : (
      <ButtonLink href={`/analysis/${analysisId}`} variant="outline">
        {t("backToReport")}
      </ButtonLink>
    );

  return (
    <EmptyState
      icon={ICON[variant]}
      title={t(`${variant}.title`)}
      description={t(`${variant}.description`)}
      action={action}
    />
  );
}
