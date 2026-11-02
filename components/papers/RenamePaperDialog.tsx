"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";

import { renamePaper } from "@/lib/papers/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Rename a paper. Controlled (opened from the actions menu or the detail header)
 * rather than trigger-based, because a self-triggering dialog cannot live inside
 * a dropdown-menu item without fighting Radix focus management.
 */
export interface RenamePaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paperId: string;
  currentTitle: string;
}

export function RenamePaperDialog({
  open,
  onOpenChange,
  paperId,
  currentTitle,
}: RenamePaperDialogProps) {
  const t = useTranslations("papers.rename");
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(currentTitle);
  const [pending, setPending] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);

  // Reset the field to the current title each time the dialog opens. Adjusting
  // state during render on a prop transition is React's recommended pattern and
  // avoids a setState-in-effect cascade.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTitle(currentTitle);
  }

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentTitle && !pending;

  const onSave = async (): Promise<void> => {
    setPending(true);
    const result = await renamePaper({ paperId, title: trimmed });
    setPending(false);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ["papers-library"] });
      await queryClient.invalidateQueries({
        queryKey: ["paper-detail", paperId],
      });
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rename-paper-input">{t("label")}</Label>
          <Input
            id="rename-paper-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={500}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSave) void onSave();
            }}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button onClick={() => void onSave()} disabled={!canSave}>
            {pending ? t("saving") : t("save")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
