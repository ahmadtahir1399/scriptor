"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconClose, IconPencil } from "@/components/icons";

import type { Requirement } from "@/lib/domain/requirement";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryBadge } from "@/components/requirements/CategoryBadge";
import { CheckableMarker } from "@/components/requirements/CheckableMarker";

/**
 * One requirement in a list. Shows the rule, its category, where it came from
 * (a guideline file or "Manual"), and the honesty marker. In selectable mode it
 * carries a checkbox; with edit/delete handlers it carries row actions.
 */
export interface RequirementRowProps {
  requirement: Requirement;
  sourceLabel: string;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: (checked: boolean) => void;
  onEdit?: (requirement: Requirement) => void;
  onDelete?: (requirement: Requirement) => void;
}

export function RequirementRow({
  requirement,
  sourceLabel,
  selectable = false,
  selected = false,
  disabled = false,
  onToggle,
  onEdit,
  onDelete,
}: RequirementRowProps) {
  const t = useTranslations("requirements");
  const classifyText = `${requirement.title} ${requirement.description}`;

  return (
    <SectionCard className={disabled ? "opacity-60" : undefined}>
      <div className="flex items-start gap-3">
        {selectable ? (
          <Checkbox
            className="mt-1"
            checked={selected}
            disabled={disabled}
            onCheckedChange={(value) => onToggle?.(value === true)}
            aria-label={requirement.title}
          />
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-body text-ink">{requirement.title}</p>
          {requirement.description ? (
            <p className="text-meta text-muted">{requirement.description}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={requirement.category} />
            {!requirement.is_mandatory ? (
              <Badge variant="outline">{t("optional")}</Badge>
            ) : null}
            {sourceLabel ? (
              <Badge variant="outline">{sourceLabel}</Badge>
            ) : null}
            <CheckableMarker
              text={classifyText}
              category={requirement.category}
            />
          </div>
        </div>

        {onEdit || onDelete ? (
          <div className="flex shrink-0 items-center gap-1">
            {onEdit ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("editAction")}
                onClick={() => onEdit(requirement)}
              >
                <IconPencil aria-hidden="true" />
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("deleteAction")}
                className="text-critical"
                onClick={() => onDelete(requirement)}
              >
                <IconClose aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
