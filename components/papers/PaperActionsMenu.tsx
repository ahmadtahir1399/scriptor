"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconMore } from "@/components/icons";

import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenamePaperDialog } from "@/components/papers/RenamePaperDialog";
import { DeletePaperDialog } from "@/components/papers/DeletePaperDialog";

/**
 * The per-paper ⋯ menu: Open, Upload new version, Rename, Delete.
 *
 * Rename and Delete open CONTROLLED dialogs held here rather than trigger-based
 * ones, so they compose inside the menu without Radix focus conflicts. The menu
 * lives above the card's stretched link, so opening it never navigates.
 */
export interface PaperActionsMenuProps {
  paperId: string;
  title: string;
  currentAnalysisId: string | null;
}

export function PaperActionsMenu({
  paperId,
  title,
  currentAnalysisId,
}: PaperActionsMenuProps) {
  const t = useTranslations("papers.actions");
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const openHref = currentAnalysisId
    ? `/analysis/${currentAnalysisId}`
    : `/papers/${paperId}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("menu")}>
            <IconMore aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={openHref}>{t("open")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/upload?paperId=${paperId}`}>{t("newVersion")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setRenameOpen(true);
            }}
          >
            {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              setDeleteOpen(true);
            }}
          >
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenamePaperDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        paperId={paperId}
        currentTitle={title}
      />
      <DeletePaperDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        paperId={paperId}
        title={title}
      />
    </>
  );
}
