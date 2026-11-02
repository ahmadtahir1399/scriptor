"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { normaliseCategory } from "@/lib/requirements/config";
import { Badge } from "@/components/ui/badge";

/**
 * A requirement's category, as a badge. The category is stored as free text but
 * normalised to the fixed vocabulary here so grouping and labels stay stable.
 */
export interface CategoryBadgeProps {
  category: string | null;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const t = useTranslations("requirements.category");
  return (
    <Badge variant="secondary" className={className}>
      {t(normaliseCategory(category))}
    </Badge>
  );
}
