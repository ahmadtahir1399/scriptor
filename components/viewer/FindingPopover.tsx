"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Finding } from "@/lib/domain/analysis";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

/**
 * Hover/click popover for a highlight.
 *
 * Shows the finding's title, its suggested fix, and the two actions the reader
 * wants right there: mark resolved, or open it in the sidebar. Anchored to the
 * highlight's rectangle via an invisible anchor so it points at the exact span.
 */
export interface FindingPopoverProps {
  finding: Finding;
  open: boolean;
  resolved: boolean;
  anchorRect: { left: number; top: number; width: number; height: number };
  onOpenChange: (open: boolean) => void;
  onResolveToggle: () => void;
  onOpenInSidebar: () => void;
}

export function FindingPopover({
  finding,
  open,
  resolved,
  anchorRect,
  onOpenChange,
  onResolveToggle,
  onOpenInSidebar,
}: FindingPopoverProps) {
  const t = useTranslations("viewer.popover");

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span
          className="pointer-events-none absolute"
          style={{
            left: anchorRect.left,
            top: anchorRect.top,
            width: anchorRect.width,
            height: anchorRect.height,
          }}
          aria-hidden="true"
        />
      </PopoverAnchor>
      <PopoverContent align="start" side="top" className="w-72 p-4">
        <p className="text-body text-ink font-medium">{finding.title}</p>
        {finding.correction ? (
          <p className="text-meta text-muted mt-1">
            <span className="text-ink font-medium">{t("suggestion")}: </span>
            {finding.correction}
          </p>
        ) : finding.description ? (
          <p className="text-meta text-muted mt-1">{finding.description}</p>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onResolveToggle}>
            {resolved ? t("unresolve") : t("resolve")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenInSidebar}>
            {t("open")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
