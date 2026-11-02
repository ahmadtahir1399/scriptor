"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { ReferenceHealth } from "@/lib/db/enums";
import { healthTone } from "@/lib/domain/reference";
import { Badge } from "@/components/ui/badge";

/**
 * The one health indicator for a reference.
 *
 * Colour follows the app's semantic contract via `healthTone`: green = verified,
 * amber = needs review, red = a problem, muted = unknown. Never invents a
 * per-reference colour — the same tones the rest of the product uses.
 */
export interface HealthBadgeProps {
  health: ReferenceHealth;
  className?: string;
}

const LABEL_KEY: Record<ReferenceHealth, string> = {
  VERIFIED: "verified",
  NEEDS_CORRECTION: "needsCorrection",
  BROKEN_URL: "broken",
  NOT_FOUND: "notFound",
  UNCHECKED: "unchecked",
};

const TONE_VARIANT = {
  verified: "verified",
  warning: "warning",
  critical: "critical",
  muted: "outline",
} as const;

export function HealthBadge({ health, className }: HealthBadgeProps) {
  const t = useTranslations("analysis.references");
  const variant = TONE_VARIANT[healthTone(health)];

  return (
    <Badge variant={variant} className={className}>
      {t(LABEL_KEY[health])}
    </Badge>
  );
}
