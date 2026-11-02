"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { bandForScore, verdictKey } from "@/lib/analysis/presentation";

/**
 * One plain-language verdict line, chosen by score band.
 *
 * Never harsh — even the lowest band frames the work as revisable, not failed.
 * The exact wording lives in the message files; this only picks the key.
 */
export interface VerdictLineProps {
  score: number | null;
  settled: boolean;
}

export function VerdictLine({ score, settled }: VerdictLineProps) {
  const t = useTranslations();

  const key = verdictKey(settled ? bandForScore(score) : null);

  return <p className="text-body text-muted mt-3">{t(key)}</p>;
}
