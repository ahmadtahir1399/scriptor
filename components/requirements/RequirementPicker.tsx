"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { classifyCheckable } from "@/lib/requirements/classifyCheckable";
import { MAX_ACTIVE_REQUIREMENTS } from "@/lib/requirements/config";
import type { Requirement } from "@/lib/domain/requirement";
import { RequirementList } from "@/components/requirements/RequirementList";

/**
 * The upload-flow step that chooses which requirements apply to this analysis.
 *
 * Supported requirements are selectable (pre-selected per preference); ones
 * Scriptor cannot verify are shown greyed with their reason and are NOT
 * selectable — you can't apply a rule the engine won't run. Selection is capped
 * at `MAX_ACTIVE_REQUIREMENTS`.
 */
export interface RequirementPickerProps {
  requirements: readonly Requirement[];
  selectedIds: ReadonlySet<string>;
  onChange: (ids: Set<string>) => void;
}

export function RequirementPicker({
  requirements,
  selectedIds,
  onChange,
}: RequirementPickerProps) {
  const t = useTranslations("requirements.picker");

  const isSupported = React.useCallback(
    (requirement: Requirement) =>
      classifyCheckable(
        `${requirement.title} ${requirement.description}`,
        requirement.category,
      ).checkable,
    [],
  );

  const atCap = selectedIds.size >= MAX_ACTIVE_REQUIREMENTS;

  const onToggle = (requirement: Requirement, checked: boolean): void => {
    const next = new Set(selectedIds);
    if (checked) {
      if (next.size >= MAX_ACTIVE_REQUIREMENTS) return;
      next.add(requirement.id);
    } else {
      next.delete(requirement.id);
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-meta text-muted">
        {t("selected", {
          count: selectedIds.size,
          max: MAX_ACTIVE_REQUIREMENTS,
        })}
      </p>

      <RequirementList
        requirements={requirements}
        resolveSource={() => ""}
        selectable
        selectedIds={selectedIds}
        isDisabled={(requirement) =>
          !isSupported(requirement) ||
          (atCap && !selectedIds.has(requirement.id))
        }
        onToggle={onToggle}
      />
    </div>
  );
}
