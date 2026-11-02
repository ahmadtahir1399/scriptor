"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { IconRefresh } from "@/components/icons";

import { generatePlan } from "@/lib/todos/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

/**
 * Re-runs plan generation against the current findings — useful after resolving
 * issues in the viewer. Manual tasks are preserved by default, so the confirm is
 * reassuring rather than a warning: your own tasks stay.
 */
export interface RegeneratePlanButtonProps {
  analysisId: string;
}

export function RegeneratePlanButton({
  analysisId,
}: RegeneratePlanButtonProps) {
  const t = useTranslations("todos.regenerate");
  const queryClient = useQueryClient();

  const onConfirm = async (): Promise<void> => {
    await generatePlan({ analysisId });
    await queryClient.invalidateQueries({ queryKey: ["todos", analysisId] });
  };

  return (
    <ConfirmDialog
      title={t("title")}
      description={t("description")}
      confirmLabel={t("confirm")}
      onConfirm={onConfirm}
      trigger={
        <Button variant="ghost" size="sm">
          <IconRefresh aria-hidden="true" />
          {t("action")}
        </Button>
      }
    />
  );
}
