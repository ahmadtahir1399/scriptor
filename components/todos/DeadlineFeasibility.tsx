"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconInfo } from "@/components/icons";

import { cn } from "@/lib/utils";
import type { Feasibility } from "@/lib/todos/schedule";

/**
 * The calm effort-vs-time signal. Two tones only — green "doable", amber "tight"
 * — never a red panic or a countdown of doom. When effort outstrips the time
 * left, it points the student at the Start-here group rather than alarming them.
 */
export interface DeadlineFeasibilityProps {
  feasibility: Feasibility;
}

export function DeadlineFeasibility({ feasibility }: DeadlineFeasibilityProps) {
  const t = useTranslations("todos.feasibility");

  if (feasibility.band === "none") return null;

  const tone = feasibility.band === "doable" ? "text-verified" : "text-warning";
  const key = feasibility.band === "doable" ? "doable" : "tight";

  return (
    <p className={cn("text-meta inline-flex items-center gap-1.5", tone)}>
      <IconInfo className="size-3.5" aria-hidden="true" />
      {t(key, {
        hours: feasibility.totalHours,
        days: feasibility.daysRemaining ?? 0,
      })}
    </p>
  );
}
