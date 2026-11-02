import { z } from "zod";

import { FINDING_SEVERITIES, FINDING_TYPES } from "@/lib/db/enums";
import { uuidSchema } from "@/lib/validations/paper";

/** Viewer finding actions and the toolbar filter. */

export const resolveFindingSchema = z.object({
  findingId: uuidSchema,
  isResolved: z.boolean(),
});
export type ResolveFindingInput = z.infer<typeof resolveFindingSchema>;

export const documentUrlSchema = z.object({
  analysisId: uuidSchema,
});
export type DocumentUrlInput = z.infer<typeof documentUrlSchema>;

/**
 * The severity filter set. "GRAMMAR" and "STYLE" are TYPE filters folded into
 * the same control alongside the three severities, so the toolbar is one Select
 * rather than two. Enum members come from `lib/db/enums.ts` — never retyped.
 */
export const SEVERITY_FILTER_VALUES = [
  "ALL",
  ...FINDING_SEVERITIES,
  "GRAMMAR",
  "STYLE",
] as const;
export type SeverityFilterValue = (typeof SEVERITY_FILTER_VALUES)[number];

/** Narrowing guards so a filter value can be tested against a finding. */
export function isSeverityFilter(
  value: SeverityFilterValue,
): value is (typeof FINDING_SEVERITIES)[number] {
  return (FINDING_SEVERITIES as readonly string[]).includes(value);
}

/**
 * The filter only exposes GRAMMAR and STYLE as type filters (not SPELLING /
 * PUNCTUATION), so the predicate narrows to exactly those two — the full
 * FINDING_TYPES union isn't assignable to a SeverityFilterValue.
 */
export function isTypeFilter(
  value: SeverityFilterValue,
): value is "GRAMMAR" | "STYLE" {
  return value === "GRAMMAR" || value === "STYLE";
}

/**
 * Whether a finding matches the toolbar filter (severity OR type).
 *
 * Pure and shared, so the highlight layer and the sidebar never diverge on what
 * "High" or "Grammar" means. Resolved-visibility is handled separately by the
 * caller, since it depends on optimistic store state.
 */
export function findingMatchesFilter(
  finding: {
    severity: (typeof FINDING_SEVERITIES)[number];
    type: (typeof FINDING_TYPES)[number];
  },
  value: SeverityFilterValue,
): boolean {
  if (value === "ALL") return true;
  if (isSeverityFilter(value)) return finding.severity === value;
  if (isTypeFilter(value)) return finding.type === value;
  return true;
}
