"use client";

import * as React from "react";

import type { VersionView } from "@/lib/papers/presentation";
import { VersionRow } from "@/components/papers/VersionRow";

/**
 * The version history, newest first. A thin list — each row owns its own state
 * and actions; the live subscription lives one level up in `PaperDetailContent`.
 */
export interface VersionListProps {
  versions: readonly VersionView[];
  paperId: string;
}

export function VersionList({ versions, paperId }: VersionListProps) {
  return (
    <div className="flex flex-col gap-3">
      {versions.map((version) => (
        <VersionRow
          key={version.uploadId}
          version={version}
          paperId={paperId}
        />
      ))}
    </div>
  );
}
