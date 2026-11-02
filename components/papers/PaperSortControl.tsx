"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { PAPER_SORTS, type PaperSort } from "@/lib/papers/presentation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Library sort control. Sorting is client-side over the already-loaded cards —
 * the list is small and server round-trips would be wasteful.
 */
export interface PaperSortControlProps {
  value: PaperSort;
  onChange: (value: PaperSort) => void;
}

export function PaperSortControl({ value, onChange }: PaperSortControlProps) {
  const t = useTranslations("papers.sort");

  return (
    <Select value={value} onValueChange={(next) => onChange(next as PaperSort)}>
      <SelectTrigger className="w-48" aria-label={t("label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAPER_SORTS.map((sort) => (
          <SelectItem key={sort} value={sort}>
            {t(sort)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
