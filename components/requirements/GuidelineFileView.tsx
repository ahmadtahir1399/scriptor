"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { IconAlert, IconRefresh } from "@/components/icons";

import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import type {
  Requirement,
  RequirementFileWithRequirements,
} from "@/lib/domain/requirement";
import { classifyCheckable } from "@/lib/requirements/classifyCheckable";
import { useGuidelineFile } from "@/hooks/useGuidelineFile";
import {
  deleteGuidelineFile,
  deleteRequirement,
  reextractRequirements,
} from "@/lib/requirements/actions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { StatusPill } from "@/components/shared/StatusPill";
import { SectionCard } from "@/components/shared/SectionCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { RequirementList } from "@/components/requirements/RequirementList";
import { RequirementDialog } from "@/components/requirements/RequirementDialog";
import { ExtractionProgress } from "@/components/requirements/ExtractionProgress";

/**
 * One guideline file's extracted requirements — the client boundary that owns
 * the live subscription and the file's actions. Explicit states: processing
 * (progress streamed in), error (a specific reason, like P2's gate), and done
 * (the editable requirement list with a checkable/manual summary).
 */
export interface GuidelineFileViewProps {
  fileId: string;
  initial: RequirementFileWithRequirements;
}

export function GuidelineFileView({ fileId, initial }: GuidelineFileViewProps) {
  const t = useTranslations("requirements");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { file } = useGuidelineFile(fileId, initial);

  const [editTarget, setEditTarget] = React.useState<Requirement | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Requirement | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);
  const [isBusy, startAction] = React.useTransition();

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: ["guideline-file", fileId],
    });
    await queryClient.invalidateQueries({ queryKey: ["requirements-library"] });
  };

  const onReextract = (): void => {
    startAction(async () => {
      await reextractRequirements({ requirementFileId: fileId });
      await invalidate();
    });
  };

  const onDeleteFile = (): void => {
    startAction(async () => {
      const result = await deleteGuidelineFile({ requirementFileId: fileId });
      if (result.ok) router.push("/requirements");
    });
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteRequirement({ requirementId: deleteTarget.id });
    setDeleting(false);
    if (result.ok) {
      await invalidate();
      setDeleteTarget(null);
    }
  };

  const summary = React.useMemo(() => {
    const total = file.requirements.length;
    const checkable = file.requirements.filter(
      (requirement) =>
        classifyCheckable(
          `${requirement.title} ${requirement.description}`,
          requirement.category,
        ).checkable,
    ).length;
    return { total, checkable, manual: total - checkable };
  }, [file.requirements]);

  const actions = (
    <div className="flex items-center gap-2">
      <ButtonLink href="/upload" variant="outline" size="sm">
        {t("file.applyToPaper")}
      </ButtonLink>
      <Button variant="ghost" size="sm" onClick={onReextract} disabled={isBusy}>
        <IconRefresh
          className={cn(isBusy && "animate-spin")}
          aria-hidden="true"
        />
        {t("file.reextract")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-critical"
        onClick={onDeleteFile}
        disabled={isBusy}
      >
        {t("file.delete")}
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader title={file.file_name} actions={actions} />

      <div className="mb-6 -mt-2">
        <StatusPill status={file.extraction_status} size="sm" />
      </div>

      {file.extraction_status === "GENERATING" ? (
        <ExtractionProgress />
      ) : file.extraction_status === "ERROR" ? (
        <Alert variant="warning">
          <IconAlert />
          <div>
            <AlertTitle>{t("incompatible.title")}</AlertTitle>
            <AlertDescription>
              {t(
                `incompatible.${file.extraction_error ?? "extraction_failed"}`,
              )}
            </AlertDescription>
          </div>
        </Alert>
      ) : file.requirements.length === 0 ? (
        <SectionCard>
          <p className="text-body text-muted">{t("file.none")}</p>
        </SectionCard>
      ) : (
        <div className="flex flex-col gap-6">
          <SectionCard>
            <p className="text-body text-ink">
              {t("file.summary", {
                total: summary.total,
                checkable: summary.checkable,
                manual: summary.manual,
              })}
            </p>
          </SectionCard>

          <RequirementList
            requirements={file.requirements}
            resolveSource={() => ""}
            onEdit={(requirement) => {
              setEditTarget(requirement);
              setDialogOpen(true);
            }}
            onDelete={setDeleteTarget}
          />
        </div>
      )}

      <RequirementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requirement={editTarget}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
