"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import { deleteAccount } from "@/lib/settings/actions";
import { DELETE_CONFIRMATION_WORD } from "@/lib/validations/settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The most dangerous action in the app, gated accordingly: it spells out exactly
 * what will be destroyed, requires typing DELETE (or the account email), and only
 * then enables the final destructive confirm. While deleting, the dialog is
 * locked so the request cannot be double-submitted; on success it redirects to
 * the goodbye page (the session is already gone).
 */
export interface DeleteAccountDialogProps {
  email: string;
}

export function DeleteAccountDialog({ email }: DeleteAccountDialogProps) {
  const t = useTranslations("settings.delete");
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(false);

  const valid =
    confirmation.trim() === DELETE_CONFIRMATION_WORD ||
    confirmation.trim().toLowerCase() === email.toLowerCase();

  const onConfirm = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!valid) return;
    setPending(true);
    setError(false);
    const result = await deleteAccount({ confirmation: confirmation.trim() });
    if (result.ok) {
      router.push("/settings/deleted");
      return;
    }
    setPending(false);
    setError(true);
  };

  return (
    <AlertDialog onOpenChange={() => setConfirmation("")}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{t("trigger")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="text-meta text-muted list-disc space-y-1 pl-5">
          <li>{t("destroys.papers")}</li>
          <li>{t("destroys.analyses")}</li>
          <li>{t("destroys.files")}</li>
          <li>{t("destroys.account")}</li>
        </ul>

        <div className="space-y-2">
          <Label htmlFor="delete-confirm">{t("confirmLabel")}</Label>
          <Input
            id="delete-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={DELETE_CONFIRMATION_WORD}
            autoComplete="off"
            disabled={pending}
          />
          {error ? (
            <p className="text-critical text-meta">{t("error")}</p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!valid || pending}
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
