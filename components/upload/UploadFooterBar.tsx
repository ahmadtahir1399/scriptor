"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconSpinner } from "@/components/icons";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export interface UploadFooterBarProps {
  fileName: string | null;
  fileSizeLabel: string | null;
  canSubmit: boolean;
  isUploading: boolean;
  /** 0–100, or null before the transfer starts. */
  progress: number | null;
  onSubmit: () => void;
}

/**
 * Sticky action bar.
 *
 * Shows real transfer progress rather than a spinner: a 50 MB upload on a slow
 * connection takes long enough that an unquantified wait feels broken.
 */
export function UploadFooterBar({
  fileName,
  fileSizeLabel,
  canSubmit,
  isUploading,
  progress,
  onSubmit,
}: UploadFooterBarProps) {
  const t = useTranslations("upload.footer");

  return (
    <div className="bg-surface border-border sticky bottom-0 z-20 -mx-6 mt-8 border-t px-6 py-4 lg:-mx-8 lg:px-8">
      {isUploading ? <Progress value={progress} className="mb-3" /> : null}

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {fileName ? (
            <>
              <p className="text-body text-ink truncate font-medium">
                {fileName}
              </p>
              <p className="text-meta text-muted">
                {isUploading && progress !== null
                  ? t("uploadingPercent", { percent: progress })
                  : fileSizeLabel}
              </p>
            </>
          ) : (
            <p className="text-meta text-muted">{t("noFile")}</p>
          )}
        </div>

        <Button onClick={onSubmit} disabled={!canSubmit || isUploading}>
          {isUploading ? <IconSpinner className="animate-spin" /> : null}
          {isUploading ? t("uploading") : t("start")}
        </Button>
      </div>
    </div>
  );
}
