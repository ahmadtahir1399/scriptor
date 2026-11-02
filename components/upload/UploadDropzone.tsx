"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import { useTranslations } from "next-intl";
import { IconClose, IconLibrary, IconUpload } from "@/components/icons";

import { cn } from "@/lib/utils";
import {
  MAX_UPLOAD_BYTES,
  validateFileClientSide,
} from "@/lib/validations/upload";
import { Button } from "@/components/ui/button";

export interface UploadDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function UploadDropzone({
  file,
  onFileChange,
  disabled = false,
}: UploadDropzoneProps) {
  const t = useTranslations("upload.dropzone");
  const [error, setError] = React.useState<string | null>(null);

  const onDrop = React.useCallback(
    (accepted: File[]) => {
      const next = accepted[0];
      if (!next) return;

      // A hint for immediate feedback. The server re-validates extension,
      // size AND magic bytes regardless — this cannot be trusted.
      const problem = validateFileClientSide(next);
      if (problem) {
        setError(problem);
        onFileChange(null);
        return;
      }

      setError(null);
      onFileChange(next);
    },
    [onFileChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    disabled,
    multiple: false,
  });

  if (file) {
    return (
      <div className="border-border bg-bg flex items-center gap-3 rounded-lg border p-4">
        <div className="bg-primary-soft flex size-10 shrink-0 items-center justify-center rounded-md">
          <IconLibrary className="text-primary size-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-body text-ink truncate font-medium">{file.name}</p>
          <p className="text-meta text-muted">{formatBytes(file.size)}</p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setError(null);
            onFileChange(null);
          }}
          disabled={disabled}
          aria-label={t("clear")}
        >
          <IconClose aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "flex h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          isDragActive
            ? "border-primary bg-primary-soft border-solid"
            : "border-border hover:border-muted",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input {...getInputProps()} />

        <div className="bg-primary-soft flex size-12 items-center justify-center rounded-full">
          <IconUpload className="text-primary size-5" aria-hidden="true" />
        </div>

        <p className="text-body text-ink mt-4 font-medium">{t("prompt")}</p>
        <p className="text-meta text-muted mt-1">{t("constraints")}</p>
      </div>

      {error ? (
        <p className="text-meta text-critical mt-2">{t(error)}</p>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
