"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  normaliseCategory,
  REQUIREMENT_CATEGORIES,
} from "@/lib/requirements/config";
import type { Requirement } from "@/lib/domain/requirement";
import { RequirementRow } from "@/components/requirements/RequirementRow";

/**
 * A list of requirements grouped by category. Selection, edit and delete are all
 * optional so the same list serves the read-only library, the editable file
 * detail, and the selectable upload picker.
 */
export interface RequirementListProps {
  requirements: readonly Requirement[];
  /** Human label for where a requirement came from (file name or "Manual"). */
  resolveSource: (requirement: Requirement) => string;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  isDisabled?: (requirement: Requirement) => boolean;
  onToggle?: (requirement: Requirement, checked: boolean) => void;
  onEdit?: (requirement: Requirement) => void;
  onDelete?: (requirement: Requirement) => void;
}

export function RequirementList({
  requirements,
  resolveSource,
  selectable = false,
  selectedIds,
  isDisabled,
  onToggle,
  onEdit,
  onDelete,
}: RequirementListProps) {
  const t = useTranslations("requirements.category");

  const grouped = React.useMemo(() => {
    const byCategory = new Map<string, Requirement[]>();
    for (const requirement of requirements) {
      const category = normaliseCategory(requirement.category);
      const list = byCategory.get(category);
      if (list) list.push(requirement);
      else byCategory.set(category, [requirement]);
    }
    return REQUIREMENT_CATEGORIES.filter((category) =>
      byCategory.has(category),
    ).map((category) => ({
      category,
      items: byCategory.get(category) ?? [],
    }));
  }, [requirements]);

  return (
    <div className="flex flex-col gap-6">
      {grouped.map((group) => (
        <section key={group.category} className="space-y-2">
          <h3 className="text-micro text-muted uppercase">
            {t(group.category)}
          </h3>
          <div className="flex flex-col gap-2">
            {group.items.map((requirement) => (
              <RequirementRow
                key={requirement.id}
                requirement={requirement}
                sourceLabel={resolveSource(requirement)}
                selectable={selectable}
                selected={selectedIds?.has(requirement.id) ?? false}
                disabled={isDisabled?.(requirement) ?? false}
                onToggle={
                  onToggle
                    ? (checked) => onToggle(requirement, checked)
                    : undefined
                }
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
