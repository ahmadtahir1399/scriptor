"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { FindingSeverity } from "@/lib/db/enums";
import { severityToDifficulty } from "@/lib/defense/practice";
import { Badge } from "@/components/ui/badge";

/**
 * A question's difficulty tier. Stored on the finding_severity enum
 * (LOW/MEDIUM/HIGH), rendered as foundational / probing / challenging.
 */
export interface DifficultyBadgeProps {
  difficulty: FindingSeverity;
}

const VARIANT = {
  foundational: "outline",
  probing: "secondary",
  challenging: "warning",
} as const;

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const t = useTranslations("defense.difficulty");
  const tier = severityToDifficulty(difficulty);
  return <Badge variant={VARIANT[tier]}>{t(tier)}</Badge>;
}
