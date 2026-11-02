"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconLink } from "@/components/icons";

import type { BibliographyReference } from "@/lib/domain/reference";
import { parseHealthDetail } from "@/lib/validations/reference";
import { Link } from "@/i18n/routing";

/**
 * The "why" behind a reference's verdict.
 *
 * Every health status shows its evidence — this is the forensic promise of the
 * feature made visible: "Matched on Crossref", "The DOI did not resolve", "No
 * matching record found". The evidence CODE and winning provider are read from
 * `health_detail` (encoded server-side) and rendered here through localised
 * templates, so no verdict sentence is ever hard-coded.
 */
export interface ReferenceEvidenceProps {
  reference: BibliographyReference;
}

export function ReferenceEvidence({ reference }: ReferenceEvidenceProps) {
  const t = useTranslations("analysis.references");
  const { code, source } = parseHealthDetail(reference.health_detail);

  const sentence = code
    ? t(`evidence.${code}`, { provider: source ? t(`provider.${source}`) : "" })
    : reference.health === "UNCHECKED"
      ? t("evidence.unverified")
      : "";

  return (
    <div className="text-meta text-muted space-y-2">
      {sentence ? <p>{sentence}</p> : null}

      {reference.doi ? (
        <p className="tabular-nums">
          <span className="text-micro text-muted uppercase">DOI</span>{" "}
          {reference.doi}
        </p>
      ) : null}

      {reference.resolved_url ? (
        <Link
          href={reference.resolved_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 hover:underline"
        >
          <IconLink className="size-3.5" aria-hidden="true" />
          {t("openLink")}
        </Link>
      ) : null}
    </div>
  );
}
