"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { FindingSeverity } from "@/lib/db/enums";
import type { Finding } from "@/lib/domain/analysis";
import { Button } from "@/components/ui/button";

/**
 * One finding row in the sidebar.
 *
 * The verbatim quote renders in serif on the highlight tint — the student's own
 * words. Hovering the row brightens the matching highlight in the document;
 * clicking scrolls the document to it and pulses it. Resolving strikes the row
 * through instantly (optimistic).
 */
export interface FindingSidebarItemProps {
  finding: Finding;
  resolved: boolean;
  focused: boolean;
  onHover: (id: string | null) => void;
  onFocus: (id: string) => void;
  onResolveToggle: (id: string, nextResolved: boolean) => void;
}

const DOT_TONE: Record<FindingSeverity, string> = {
  HIGH: "bg-critical",
  MEDIUM: "bg-warning",
  LOW: "bg-muted",
};

export function FindingSidebarItem({
  finding,
  resolved,
  focused,
  onHover,
  onFocus,
  onResolveToggle,
}: FindingSidebarItemProps) {
  const t = useTranslations("viewer.sidebar");

  return (
    <div
      data-finding-id={finding.id}
      onMouseEnter={() => onHover(finding.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "border-border rounded-md border p-3 transition-colors",
        focused
          ? "border-primary bg-primary-soft"
          : "bg-surface hover:border-muted",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            DOT_TONE[finding.severity],
          )}
          aria-hidden="true"
        />
        <span className="text-micro text-muted uppercase">
          {t(`severity.${finding.severity}`)}
        </span>
        {finding.page_number !== null ? (
          <span className="text-micro text-muted">
            · {t("page", { page: finding.page_number })}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onFocus(finding.id)}
        className="mt-2 block w-full text-left"
      >
        <span
          className={cn(
            "bg-highlight/40 text-highlight-foreground line-clamp-2 rounded-sm px-1.5 py-1 prose-thesis",
            resolved && "text-muted line-through opacity-60",
          )}
        >
          {finding.quote}
        </span>
        {finding.title ? (
          <span
            className={cn(
              "text-meta text-ink mt-1.5 block",
              resolved && "line-through opacity-60",
            )}
          >
            {finding.title}
          </span>
        ) : null}
      </button>

      <div className="mt-2 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onResolveToggle(finding.id, !resolved)}
        >
          {resolved ? t("unresolve") : t("resolve")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onFocus(finding.id)}>
          {t("view")}
        </Button>
      </div>
    </div>
  );
}
