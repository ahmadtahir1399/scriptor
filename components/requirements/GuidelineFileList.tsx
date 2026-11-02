"use client";

import * as React from "react";

import type { RequirementFile } from "@/lib/domain/requirement";
import { GuidelineFileCard } from "@/components/requirements/GuidelineFileCard";
import { GuidelineUploadDropzone } from "@/components/requirements/GuidelineUploadDropzone";

/**
 * The Guideline files tab: the upload dropzone, then a card per uploaded
 * document. The dropzone lives here so a student can add another rulebook
 * without leaving the library.
 */
export interface GuidelineFileListProps {
  files: readonly RequirementFile[];
  requirementCountByFile: Readonly<Record<string, number>>;
}

export function GuidelineFileList({
  files,
  requirementCountByFile,
}: GuidelineFileListProps) {
  return (
    <div className="flex flex-col gap-4">
      <GuidelineUploadDropzone />

      {files.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {files.map((file) => (
            <GuidelineFileCard
              key={file.id}
              file={file}
              requirementCount={requirementCountByFile[file.id] ?? 0}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
