"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconAlert, IconCheckCircle } from "@/components/icons";

import { classifyCheckable } from "@/lib/requirements/classifyCheckable";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The honesty marker. A requirement Scriptor can verify from text shows a calm
 * green "Checkable"; one it cannot — margins, font, spacing, physical layout —
 * shows an amber "Manual only" with a plain reason. Marking these honestly is
 * what lets the student trust the ones that ARE checked. Checkability is derived
 * live via `classifyCheckable`, never stored.
 */
export interface CheckableMarkerProps {
  text: string;
  category?: string | null;
}

export function CheckableMarker({ text, category }: CheckableMarkerProps) {
  const t = useTranslations("requirements.checkable");
  const verdict = classifyCheckable(text, category);

  if (verdict.checkable) {
    return (
      <Badge variant="verified">
        <IconCheckCircle aria-hidden="true" />
        {t("checkable")}
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Badge variant="warning">
            <IconAlert aria-hidden="true" />
            {t("manualOnly")}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent className="normal-case">
        {t(`reason.${verdict.reasonKey ?? "physical"}`)}
      </TooltipContent>
    </Tooltip>
  );
}
