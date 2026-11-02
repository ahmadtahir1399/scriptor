"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";

import {
  normaliseCategory,
  REQUIREMENT_CATEGORIES,
} from "@/lib/requirements/config";
import type { Requirement } from "@/lib/domain/requirement";
import {
  createManualRequirement,
  updateRequirement,
} from "@/lib/requirements/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckableMarker } from "@/components/requirements/CheckableMarker";

/**
 * Author or edit one requirement.
 *
 * A textarea for the rule, a category select, and a LIVE checkability hint that
 * classifies as the student types — the same client heuristic the server
 * confirms. The guidance nudges toward specific, testable rules: a concrete rule
 * checks far better than a vague one.
 */
export interface RequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present → edit; absent → create a new manual requirement. */
  requirement?: Requirement | null;
}

export function RequirementDialog({
  open,
  onOpenChange,
  requirement,
}: RequirementDialogProps) {
  const t = useTranslations("requirements.dialog");
  const tc = useTranslations("requirements.category");
  const queryClient = useQueryClient();
  const isEdit = Boolean(requirement);

  const [title, setTitle] = React.useState(requirement?.title ?? "");
  const [category, setCategory] = React.useState<string>(
    normaliseCategory(requirement?.category),
  );
  const [mandatory, setMandatory] = React.useState(
    requirement?.is_mandatory ?? true,
  );
  const [pending, setPending] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);

  // Reset the form to the target requirement each time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(requirement?.title ?? "");
      setCategory(normaliseCategory(requirement?.category));
      setMandatory(requirement?.is_mandatory ?? true);
    }
  }

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !pending;

  const onSave = async (): Promise<void> => {
    setPending(true);
    const result = requirement
      ? await updateRequirement({
          requirementId: requirement.id,
          title: trimmed,
          category,
          isMandatory: mandatory,
        })
      : await createManualRequirement({
          title: trimmed,
          category,
          isMandatory: mandatory,
        });
    setPending(false);
    if (result.ok) {
      await queryClient.invalidateQueries({
        queryKey: ["requirements-library"],
      });
      if (requirement?.requirement_file_id) {
        await queryClient.invalidateQueries({
          queryKey: ["guideline-file", requirement.requirement_file_id],
        });
      }
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
          <AlertDialogDescription>{t("guidance")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="requirement-rule">{t("ruleLabel")}</Label>
            <Textarea
              id="requirement-rule"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("rulePlaceholder")}
              rows={3}
              maxLength={500}
              autoFocus
            />
            {trimmed.length > 0 ? (
              <CheckableMarker text={trimmed} category={category} />
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="requirement-category">{t("categoryLabel")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="requirement-category" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_CATEGORIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tc(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 pb-2 text-body">
              <Checkbox
                checked={mandatory}
                onCheckedChange={(value) => setMandatory(value === true)}
              />
              {t("mandatory")}
            </label>
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
