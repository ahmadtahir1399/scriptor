import type { Tables, Views } from "@/lib/db/types.generated";
import type { JobStatus } from "@/lib/db/enums";

/** Analysis aggregate — the report page (P6) is built entirely on these. */

export type PaperAnalysis = Tables<"paper_analyses">;
export type CheckResult = Tables<"check_results">;
export type Finding = Tables<"findings">;
export type PublicCheck = Views<"checks_public">;

/**
 * A check result joined to the catalogue entry that produced it.
 *
 * Note this joins `checks_public`, not `checks` — the view is what ordinary
 * users are granted, and it carries no prompt text.
 */
export interface CheckResultWithCheck extends CheckResult {
  check: PublicCheck | null;
}

export interface CheckResultWithVersion extends CheckResultWithCheck {
  findings: Finding[];
}

/** The full report payload. */
export interface AnalysisWithResults extends PaperAnalysis {
  check_results: CheckResultWithVersion[];
}

/** The five optional features, in the order the report renders them. */
export const OPTIONAL_FEATURES = [
  "plagiarism",
  "todo",
  "defense",
  "reference_health",
  "ai_detection",
] as const;

export type OptionalFeature = (typeof OPTIONAL_FEATURES)[number];

const FEATURE_STATUS_COLUMN = {
  plagiarism: "plagiarism_status",
  todo: "todo_status",
  defense: "defense_status",
  reference_health: "reference_health_status",
  ai_detection: "ai_detection_status",
} as const satisfies Record<OptionalFeature, keyof PaperAnalysis>;

export function featureStatus(
  analysis: PaperAnalysis,
  feature: OptionalFeature,
): JobStatus {
  return analysis[FEATURE_STATUS_COLUMN[feature]];
}

/**
 * Whether a feature should appear in the UI at all.
 *
 * NONE means the student never requested it, so the report shows nothing —
 * not an empty panel and certainly not a failure badge. This distinction is
 * the reason job_status has a NONE member.
 */
export function isFeatureRequested(
  analysis: PaperAnalysis,
  feature: OptionalFeature,
): boolean {
  return featureStatus(analysis, feature) !== "NONE";
}

/** Progress for the report header, counting only results actually shown. */
export interface AnalysisProgress {
  total: number;
  completed: number;
  failed: number;
  running: number;
  percent: number;
}

export function computeProgress(
  results: readonly CheckResult[],
): AnalysisProgress {
  const visible = results.filter((result) => !result.hidden_because_ab_test);

  const total = visible.length;
  const completed = visible.filter((r) => r.status === "DONE").length;
  const failed = visible.filter((r) => r.status === "ERROR").length;
  const running = visible.filter((r) => r.status === "GENERATING").length;

  return {
    total,
    completed,
    failed,
    running,
    // Failed checks are finished, just not successfully — counting them as
    // progress keeps the bar from stalling at 90% forever on a partial failure.
    percent: total === 0 ? 0 : Math.round(((completed + failed) / total) * 100),
  };
}

/** Findings grouped by page, for the P7 viewer's per-page overlay. */
export function groupFindingsByPage(
  findings: readonly Finding[],
): Map<number, Finding[]> {
  const byPage = new Map<number, Finding[]>();

  for (const finding of findings) {
    if (finding.page_number === null) continue;
    const existing = byPage.get(finding.page_number);
    if (existing) {
      existing.push(finding);
    } else {
      byPage.set(finding.page_number, [finding]);
    }
  }

  return byPage;
}
