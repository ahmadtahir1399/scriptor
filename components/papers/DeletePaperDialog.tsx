"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { deletePaper } from "@/lib/papers/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

/**
 * Delete a paper — irreversible, and gated behind this destructive confirm. The
 * copy names the paper and spells out that every version, analysis and uploaded
 * file goes with it. The delete itself relies on the schema's ON DELETE cascade;
 * there is no manual multi-table deletion anywhere in app code.
 */
export interface DeletePaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paperId: string;
  title: string;
  /** Called after a successful delete — e.g. navigate away from the detail page. */
  onDeleted?: () => void;
}

export function DeletePaperDialog({
  open,
  onOpenChange,
  paperId,
  title,
  onDeleted,
}: DeletePaperDialogProps) {
  const t = useTranslations("papers.delete");
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState(false);

  const onConfirm = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ): Promise<void> => {
    event.preventDefault(); // keep the dialog up while the delete runs
    setPending(true);
    const result = await deletePaper({ paperId });
    setPending(false);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ["papers-library"] });
      onOpenChange(false);
      onDeleted?.();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title", { title })}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => void onConfirm(event)}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {pending ? t("deleting") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
