"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/constants";
import { IconAlert, IconCheck, IconClock, IconSpinner } from "@/components/icons";

/**
 * The one job-state indicator in the app.
 *
 * Colour follows the semantic contract in `globals.css`:
 *   almond  = not started    honey = working
 *   sage    = complete       clay  = failed
 *
 * Note what is NOT here: `primary`. Pine is the brand and structural colour
 * and never encodes state — a pine pill would be indistinguishable from a
 * pine button at a glance. "In progress" moved to the honey family, which is
 * the palette's colour for something live and working.
 *
 * The label always ships with the colour. Every state is a word the student
 * recognises ("In progress", not "job queued"), and the hue only reinforces
 * it — the four foregrounds are mutually ~1.2:1, so nobody is asked to tell
 * them apart by colour.
 *
 * P4, P6, P9, P16 and P17 all render this rather than inventing a per-feature
 * badge.
 */
export interface StatusPillProps {
  status: JobStatus;
  size?: "sm" | "md";
  className?: string;
}

interface StatusAppearance {
  className: string;
  icon: typeof IconCheck;
  spin: boolean;
  labelKey: "none" | "generating" | "done" | "error";
}

const APPEARANCE: Record<JobStatus, StatusAppearance> = {
  NONE: {
    className: "bg-primary-soft/50 text-muted border-transparent",
    icon: IconClock,
    spin: false,
    labelKey: "none",
  },
  GENERATING: {
    className: "bg-warning-soft text-warning border-transparent",
    icon: IconSpinner,
    spin: true,
    labelKey: "generating",
  },
  DONE: {
    className: "bg-verified-soft text-verified border-transparent",
    icon: IconCheck,
    spin: false,
    labelKey: "done",
  },
  ERROR: {
    className: "bg-critical-soft text-critical border-transparent",
    icon: IconAlert,
    spin: false,
    labelKey: "error",
  },
};

export function StatusPill({
  status,
  size = "md",
  className,
}: StatusPillProps) {
  const t = useTranslations("common.status");
  const appearance = APPEARANCE[status];
  const Icon = appearance.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-micro" : "px-2 py-1 text-meta",
        appearance.className,
        className,
      )}
    >
      <Icon
        className={cn(
          size === "sm" ? "size-3" : "size-3.5",
          appearance.spin && "animate-spin",
        )}
        aria-hidden="true"
      />
      {t(appearance.labelKey)}
    </span>
  );
}
