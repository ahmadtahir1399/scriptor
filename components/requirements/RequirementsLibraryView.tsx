"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { IconPlus, IconUpload } from "@/components/icons";

import type { Requirement } from "@/lib/domain/requirement";
import { useRequirements } from "@/hooks/useRequirements";
import type { RequirementsLibrary } from "@/lib/requirements/actions";
import { deleteRequirement } from "@/lib/requirements/actions";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { RequirementList } from "@/components/requirements/RequirementList";
import { RequirementDialog } from "@/components/requirements/RequirementDialog";
import { GuidelineFileList } from "@/components/requirements/GuidelineFileList";
import { RequirementsEmptyState } from "@/components/requirements/RequirementsEmptyState";

/**
 * The requirements library — the client boundary that owns the live
 * subscription, the tabs, and the create/edit/delete dialogs. Server-rendered
 * `initial` seeds first paint; extraction status streams in via `useRequirements`.
 */
export interface RequirementsLibraryViewProps {
  initial: RequirementsLibrary;
  userId: string;
}

export function RequirementsLibraryView({
  initial,
  userId,
}: RequirementsLibraryViewProps) {
  const t = useTranslations("requirements");
  const queryClient = useQueryClient();
  const { library } = useRequirements(initial, userId);

  const [tab, setTab] = React.useState<"all" | "files">("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Requirement | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Requirement | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);

  const fileNames = React.useMemo(
    () =>
      Object.fromEntries(
        library.files.map((file) => [file.id, file.file_name]),
      ),
    [library.files],
  );

  const countByFile = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const requirement of library.requirements) {
      counts[requirement.requirement_file_id] =
        (counts[requirement.requirement_file_id] ?? 0) + 1;
    }
    return counts;
  }, [library.requirements]);

  const resolveSource = React.useCallback(
    (requirement: Requirement): string =>
      requirement.requirement_file_id === library.manualFileId
        ? t("source.manual")
        : (fileNames[requirement.requirement_file_id] ?? t("source.unknown")),
    [fileNames, library.manualFileId, t],
  );

  const openCreate = (): void => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (requirement: Requirement): void => {
    setEditTarget(requirement);
    setDialogOpen(true);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteRequirement({ requirementId: deleteTarget.id });
    setDeleting(false);
    if (result.ok) {
      await queryClient.invalidateQueries({
        queryKey: ["requirements-library"],
      });
      setDeleteTarget(null);
    }
  };

  const isEmpty =
    library.files.length === 0 && library.requirements.length === 0;

  const actions = (
    <div className="flex items-center gap-2">
      <Button onClick={() => setTab("files")}>
        <IconUpload aria-hidden="true" />
        {t("actions.upload")}
      </Button>
      <Button variant="outline" onClick={openCreate}>
        <IconPlus aria-hidden="true" />
        {t("actions.add")}
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={actions}
      />

      {isEmpty ? (
        <RequirementsEmptyState action={actions} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "all" | "files")}
        >
          <TabsList>
            <TabsTrigger value="all">
              {t("tabs.all", { count: library.requirements.length })}
            </TabsTrigger>
            <TabsTrigger value="files">
              {t("tabs.files", { count: library.files.length })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {library.requirements.length > 0 ? (
              <RequirementList
                requirements={library.requirements}
                resolveSource={resolveSource}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            ) : (
              <RequirementsEmptyState action={actions} />
            )}
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <GuidelineFileList
              files={library.files}
              requirementCountByFile={countByFile}
            />
          </TabsContent>
        </Tabs>
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
