import type { Tables } from "@/lib/db/types.generated";

/** Requirements aggregate — P11. */

export type RequirementFile = Tables<"requirement_files">;
export type Requirement = Tables<"requirements">;
export type UploadRequirement = Tables<"upload_requirements">;

export interface RequirementFileWithRequirements extends RequirementFile {
  requirements: Requirement[];
}

/** A requirement with how the current upload scored against it. */
export interface RequirementWithResult extends Requirement {
  upload_requirement: UploadRequirement | null;
}

export interface RequirementSummary {
  total: number;
  satisfied: number;
  violated: number;
  pending: number;
  /** Violated AND mandatory — the ones that can fail a submission. */
  mandatoryViolations: number;
}

export function summariseRequirements(
  items: readonly RequirementWithResult[],
): RequirementSummary {
  let satisfied = 0;
  let violated = 0;
  let pending = 0;
  let mandatoryViolations = 0;

  for (const item of items) {
    const result = item.upload_requirement;

    // No result row, or the check has not finished, is pending — not a pass.
    // Reporting an unevaluated requirement as satisfied would be the worst
    // possible error this feature could make.
    if (!result || result.status !== "DONE" || result.is_satisfied === null) {
      pending += 1;
      continue;
    }

    if (result.is_satisfied) {
      satisfied += 1;
    } else {
      violated += 1;
      if (item.is_mandatory) {
        mandatoryViolations += 1;
      }
    }
  }

  return {
    total: items.length,
    satisfied,
    violated,
    pending,
    mandatoryViolations,
  };
}

/**
 * Storage path for a requirement file. As with theses, the first segment must
 * be the owner id or the storage policy denies access.
 */
export function requirementStoragePath(
  userId: string,
  requirementFileId: string,
  fileName: string,
): string {
  return `${userId}/${requirementFileId}/${fileName}`;
}
