"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { IconSpinner, IconUpload } from "@/components/icons";

import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { REQUIREMENTS_BUCKET } from "@/lib/upload/constants";
import { MAX_REQUIREMENT_BYTES } from "@/lib/validations/requirement";
import {
  finaliseGuidelineUpload,
  prepareGuidelineUpload,
} from "@/lib/requirements/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Uploads a university/journal guidelines PDF and kicks off extraction.
 *
 * Reserves the row and a signed upload URL, PUTs the file straight to the
 * private `requirements` bucket, then finalises — which runs extraction inline.
 * On success it lands on the file's detail page, where progress and the
 * generated requirements stream in. Validated client-side for fast feedback;
 * the server re-checks the extension, size and magic bytes regardless.
 */
export function GuidelineUploadDropzone() {
  const t = useTranslations("requirements.upload");
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<"idle" | "uploading" | "processing">(
    "idle",
  );

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<string> => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".pdf"))
        throw new Error(t("errors.notPdf"));
      if (file.size > MAX_REQUIREMENT_BYTES)
        throw new Error(t("errors.tooLarge"));
      if (file.size === 0) throw new Error(t("errors.empty"));

      setPhase("uploading");
      const prepared = await prepareGuidelineUpload({
        fileName: file.name,
        fileSizeBytes: file.size,
      });
      if (!prepared.ok) throw new Error(prepared.error);

      const url =
        `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/` +
        `${REQUIREMENTS_BUCKET}/${prepared.data.path}?token=${encodeURIComponent(prepared.data.token)}`;
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/pdf" },
        body: file,
      });
      if (!put.ok) throw new Error(t("errors.uploadFailed"));

      setPhase("processing");
      const finalised = await finaliseGuidelineUpload({
        requirementFileId: prepared.data.requirementFileId,
      });
      if (!finalised.ok) throw new Error(t("errors.uploadFailed"));

      return prepared.data.requirementFileId;
    },
    onSuccess: async (fileId) => {
      await queryClient.invalidateQueries({
        queryKey: ["requirements-library"],
      });
      setPhase("idle");
      router.push(`/requirements/${fileId}`);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setPhase("idle");
    },
  });

  const busy = mutation.isPending;

  return (
    <div>
      {error ? (
        <Alert variant="critical" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={cn(
          "border-border flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
          busy
            ? "cursor-wait opacity-80"
            : "hover:border-primary hover:bg-primary-soft/40",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) mutation.mutate(file);
            event.target.value = "";
          }}
        />

        {busy ? (
          <IconSpinner
            className="text-primary size-5 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <IconUpload className="text-primary size-5" aria-hidden="true" />
        )}
        <span className="text-body text-ink font-medium">
          {busy
            ? phase === "processing"
              ? t("processing")
              : t("uploading")
            : t("cta")}
        </span>
        <span className="text-meta text-muted">{t("hint")}</span>
      </button>
    </div>
  );
}
