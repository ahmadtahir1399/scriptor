"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  SEVERITY_FILTER_VALUES,
  type SeverityFilterValue,
} from "@/lib/validations/finding";
import { useViewerStore } from "@/store/viewerStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The findings filter — All / High / Medium / Low / Grammar / Style — as one
 * Select folding severity and type filters into a single control. Its value
 * lives in `viewerStore` so both the highlight layer and the sidebar filter
 * live off the same choice.
 */
export function SeverityFilter() {
  const t = useTranslations("viewer.filter");
  const value = useViewerStore((s) => s.severityFilter);
  const setValue = useViewerStore((s) => s.setSeverityFilter);

  return (
    <Select
      value={value}
      onValueChange={(next) => setValue(next as SeverityFilterValue)}
    >
      <SelectTrigger className="h-8 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SEVERITY_FILTER_VALUES.map((option) => (
          <SelectItem key={option} value={option}>
            {t(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
