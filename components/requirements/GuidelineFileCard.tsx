"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { IconLibrary } from "@/components/icons";

import { Link } from "@/i18n/routing";
import type { RequirementFile } from "@/lib/domain/requirement";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/shared/StatusPill";

/**
 * One uploaded guideline document: its name, when it was added, a live
 * extraction status, and how many requirements it produced. The whole card
 * links to the file's detail page.
 */
export interface GuidelineFileCardProps {
  file: RequirementFile;
  requirementCount: number;
}

export function GuidelineFileCard({
  file,
  requirementCount,
}: GuidelineFileCardProps) {
  const t = useTranslations("requirements");
  const format = useFormatter();

  return (
    <Card className="relative transition-shadow hover:shadow-card">
      <CardContent className="p-5">
        <Link
          href={`/requirements/${file.id}`}
          className="absolute inset-0 z-0 rounded-lg"
          aria-label={file.file_name}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <IconLibrary
              className="text-muted mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-body text-ink truncate font-medium">
                {file.file_name}
              </p>
              <p className="text-meta text-muted mt-0.5">
                {format.relativeTime(new Date(file.created_at))}
              </p>
            </div>
          </div>
          <StatusPill status={file.extraction_status} size="sm" />
        </div>

        <p className="text-meta text-muted mt-3">
          {t("file.generated", { count: requirementCount })}
        </p>
      </CardContent>
    </Card>
  );
}
