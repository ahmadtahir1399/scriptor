"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";

import { publicEnv } from "@/lib/env";
import { finaliseUpload, prepareUpload } from "@/lib/upload/actions";
import { attachRequirementsToUpload } from "@/lib/requirements/actions";
import type { UploadSettings } from "@/lib/validations/upload";
import { PAPERS_BUCKET } from "@/lib/upload/constants";

/**
 * Drives the three-step upload.
 *
 *   1. `prepareUpload()` reserves the rows and returns a signed URL.
 *   2. The browser PUTs the file straight to storage.
 *   3. `finaliseUpload()` enqueues PARSE.
 *
 * Step 2 uses XMLHttpRequest rather than fetch purely for `upload.onprogress`:
 * fetch still has no upload progress event, and a 50 MB transfer with no
 * feedback looks like a hung page.
 */

export interface UseUploadResult {
  /**
   * `paperId` binds the upload to an existing paper as a new version;
   * `requirementIds` attaches custom requirements to run at analysis time.
   */
  submit: (file: File, settings: UploadSettings, paperId?: string, requirementIds?: string[]) => void;
  isUploading: boolean;
  progress: number | null;
  error: string | null;
  uploadId: string | null;
}

export function useUpload(onComplete: (uploadId: string) => void): UseUploadResult {
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadId, setUploadId] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      file,
      settings,
      paperId,
      requirementIds,
    }: {
      file: File;
      settings: UploadSettings;
      paperId?: string;
      requirementIds?: string[];
    }): Promise<string> => {
      setError(null);
      setProgress(0);

      const prepared = await prepareUpload(settings, paperId);
      if (!prepared.ok) throw new Error(prepared.error);

      setUploadId(prepared.data.uploadId);

      // Attach the chosen custom requirements before ingestion — they are read
      // by the engine at analysis time.
      if (requirementIds && requirementIds.length > 0) {
        await attachRequirementsToUpload({ uploadId: prepared.data.uploadId, requirementIds });
      }

      await putWithProgress(prepared.data.path, prepared.data.token, file, setProgress);

      const finalised = await finaliseUpload(prepared.data.uploadId);
      if (!finalised.ok) throw new Error(finalised.error);

      return prepared.data.uploadId;
    },
    onSuccess: (id) => {
      setProgress(100);
      onComplete(id);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      setProgress(null);
    },
  });

  const submit = React.useCallback(
    (file: File, settings: UploadSettings, paperId?: string, requirementIds?: string[]) => {
      mutation.mutate({ file, settings, paperId, requirementIds });
    },
    [mutation],
  );

  return {
    submit,
    isUploading: mutation.isPending,
    progress,
    error,
    uploadId,
  };
}

/**
 * Uploads via the signed-upload token.
 *
 * The token authorises exactly one write to exactly one path, so nothing here
 * needs the user's session — and the path was built server-side from the
 * session user id, so a client cannot redirect the write elsewhere.
 */
function putWithProgress(
  path: string,
  token: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/${PAPERS_BUCKET}/${path}?token=${encodeURIComponent(token)}`;

    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    request.setRequestHeader("content-type", file.type || "application/pdf");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      // Cap at 99: the transfer finishing is not the upload finishing — the
      // finalise call still has to land.
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${request.status})`));
      }
    };

    request.onerror = () => reject(new Error("Upload failed. Check your connection."));
    request.onabort = () => reject(new Error("Upload cancelled."));

    request.send(file);
  });
}
