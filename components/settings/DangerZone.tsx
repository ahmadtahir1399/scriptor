"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAlert } from "@/components/icons";

import { Card, CardContent } from "@/components/ui/card";
import { AnonymiseAccountDialog } from "@/components/settings/AnonymiseAccountDialog";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";

/**
 * The account-closure zone — deliberately set apart and critical-framed, so an
 * irreversible action can never be triggered by a stray click meant for a
 * settings toggle. Offers the softer anonymise path beside permanent deletion.
 */
export interface DangerZoneProps {
  email: string;
}

export function DangerZone({ email }: DangerZoneProps) {
  const t = useTranslations("settings.danger");

  return (
    <Card className="border-critical/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <IconAlert
            className="text-critical size-4"
            aria-hidden="true"
          />
          <h2 className="text-section-title text-ink">{t("title")}</h2>
        </div>
        <p className="text-meta text-muted">{t("description")}</p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-body text-ink">{t("anonymiseLabel")}</p>
            <p className="text-meta text-muted">{t("anonymiseHint")}</p>
          </div>
          <AnonymiseAccountDialog />
        </div>

        <div className="border-critical/20 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-body text-ink">{t("deleteLabel")}</p>
            <p className="text-meta text-muted">{t("deleteHint")}</p>
          </div>
          <DeleteAccountDialog email={email} />
        </div>
      </CardContent>
    </Card>
  );
}
