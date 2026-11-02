"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";

import type { TodoItem as TodoItemRow } from "@/lib/db/queries/todos";
import { addTodo, updateTodo } from "@/lib/todos/actions";
import { decodeItemDescription, formatMinutes } from "@/lib/todos/schedule";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Add or edit a task the student owns. Manual tasks sit alongside generated
 * ones and are clearly the student's own; they are preserved across plan
 * regeneration.
 */
export interface TodoAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  /** Present → edit an existing manual task; absent → add a new one. */
  item?: TodoItemRow | null;
}

const ESTIMATE_OPTIONS = [15, 30, 60, 120, 240] as const;

export function TodoAddDialog({
  open,
  onOpenChange,
  analysisId,
  item,
}: TodoAddDialogProps) {
  const t = useTranslations("todos.add");
  const queryClient = useQueryClient();
  const isEdit = Boolean(item);

  const decoded = item ? decodeItemDescription(item.description) : null;
  const [title, setTitle] = React.useState(item?.title ?? "");
  const [description, setDescription] = React.useState(decoded?.text ?? "");
  const [minutes, setMinutes] = React.useState<number | null>(
    decoded?.minutes ?? 30,
  );
  const [pending, setPending] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const next = item ? decodeItemDescription(item.description) : null;
      setTitle(item?.title ?? "");
      setDescription(next?.text ?? "");
      setMinutes(next?.minutes ?? 30);
    }
  }

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !pending;

  const onSave = async (): Promise<void> => {
    setPending(true);
    const result = item
      ? await updateTodo({
          itemId: item.id,
          title: trimmed,
          description,
          estimateMinutes: minutes,
        })
      : await addTodo({
          analysisId,
          title: trimmed,
          description,
          estimateMinutes: minutes,
        });
    setPending(false);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ["todos", analysisId] });
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("subtitle")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-title">{t("titleLabel")}</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="todo-description">{t("descriptionLabel")}</Label>
            <Textarea
              id="todo-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="todo-estimate">{t("estimateLabel")}</Label>
            <Select
              value={minutes === null ? "none" : String(minutes)}
              onValueChange={(value) =>
                setMinutes(value === "none" ? null : Number(value))
              }
            >
              <SelectTrigger id="todo-estimate" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noEstimate")}</SelectItem>
                {ESTIMATE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {formatMinutes(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
