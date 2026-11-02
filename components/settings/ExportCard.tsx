"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconDownload, IconSpinner } from "@/components/icons";

import { requestExport } from "@/lib/settings/actions";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Data export. A server action assembles everything Scriptor holds about the
 * user — from RLS-scoped reads only — and the browser downloads it as a JSON
 * file. No public URL is ever minted, and the request is rate-limited.
 */
export function ExportCard() {
  const t = useTranslations("settings.export");
  const [status, setStatus] = React.useState<
    "idle" | "working" | "done" | "rate_limited" | "error"
  >("idle");
  const [isPending, startTransition] = React.useTransition();

  const onExport = (): void => {
    setStatus("working");
    startTransition(async () => {
      const result = await requestExport();
      if (!result.ok) {
        setStatus(result.error === "rate_limited" ? "rate_limited" : "error");
        return;
      }
      // Trigger a client-side download of the generated JSON.
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("done");
    });
  };

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-3">
        {status === "rate_limited" ? (
          <Alert variant="warning">
            <AlertDescription>{t("rateLimited")}</AlertDescription>
          </Alert>
        ) : null}
        {status === "error" ? (
          <Alert variant="critical">
            <AlertDescription>{t("error")}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-3">
          <Button onClick={onExport} disabled={isPending}>
            {status === "working" ? (
              <IconSpinner className="animate-spin" aria-hidden="true" />
            ) : (
              <IconDownload aria-hidden="true" />
            )}
            {status === "working" ? t("working") : t("action")}
          </Button>
          {status === "done" ? (
            <span className="text-verified text-meta">{t("done")}</span>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
