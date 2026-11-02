"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconLibrary } from "@/components/icons";

import type { BibliographyReference } from "@/lib/domain/reference";
import { Accordion } from "@/components/ui/accordion";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReferenceRow } from "@/components/references/ReferenceRow";

/**
 * The Sources tab — every bibliography entry, each expandable to its evidence.
 *
 * Rendered as a multi-open accordion so a student can compare several sources'
 * evidence side by side rather than one at a time.
 */
export interface ReferenceListProps {
  references: readonly BibliographyReference[];
  analysisId: string;
}

export function ReferenceList({ references, analysisId }: ReferenceListProps) {
  const t = useTranslations("analysis.references");

  if (references.length === 0) {
    return <EmptyState icon={IconLibrary} title={t("empty.noSourcesTitle")} />;
  }

  return (
    <Accordion type="multiple" className="flex flex-col gap-2">
      {references.map((reference) => (
        <ReferenceRow
          key={reference.id}
          reference={reference}
          analysisId={analysisId}
        />
      ))}
    </Accordion>
  );
}
