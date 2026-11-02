import {
  categoryForCheck,
  weightForCheck,
  CHECK_CATEGORIES,
  type CheckCategory,
} from "@/lib/analysis/config";

/**
 * The single source of the scoring math.
 *
 * PURE — no I/O, no database, no clock. Imported by P6 to display the score and
 * by P10 to compare versions. Neither recomputes it; both call this. If the
 * scoring logic ever lived in two places, a version comparison would silently
 * grade two drafts on two different scales.
 *
 * Fully unit-tested in `__tests__/scoring.test.ts`.
 */

export interface CheckRating {
  checkCode: string;
  /** 0–100 model quality score, or null when the check errored. */
  score: number | null;
  /** True when the check failed technically — excluded from the mean. */
  errored: boolean;
}

export interface CategoryScore {
  category: CheckCategory;
  /** Weighted mean of the category's non-errored checks, or null if all failed. */
  score: number | null;
  checkCount: number;
  scoredCount: number;
}

export interface AnalysisScore {
  /** Weighted overall, 0–100, or null when no check produced a score. */
  overall: number | null;
  categories: CategoryScore[];
  checkRatings: CheckRating[];
  /** How many checks contributed a score vs how many ran. */
  scoredCount: number;
  totalCount: number;
}

/**
 * Computes the overall and per-category scores from per-check ratings.
 *
 * The invariant that matters most: an errored check is EXCLUDED from the
 * denominator, never scored as zero. A model timeout is our failure, not the
 * student's — counting it as a 0 would turn one flaky check into a wrecked
 * grade and make the whole feature untrustworthy.
 */
export function computeAnalysisScore(
  ratings: readonly CheckRating[],
): AnalysisScore {
  const scored = ratings.filter(
    (rating): rating is CheckRating & { score: number } =>
      !rating.errored && rating.score !== null,
  );

  const overall = weightedMean(
    scored.map((rating) => ({
      value: rating.score,
      weight: weightForCheck(rating.checkCode),
    })),
  );

  const categories: CategoryScore[] = CHECK_CATEGORIES.map((category) => {
    const inCategory = ratings.filter(
      (rating) => categoryForCheck(rating.checkCode) === category,
    );
    const scoredInCategory = inCategory.filter(
      (rating): rating is CheckRating & { score: number } =>
        !rating.errored && rating.score !== null,
    );

    return {
      category,
      score: weightedMean(
        scoredInCategory.map((rating) => ({
          value: rating.score,
          weight: weightForCheck(rating.checkCode),
        })),
      ),
      checkCount: inCategory.length,
      scoredCount: scoredInCategory.length,
    };
  });

  return {
    overall,
    categories,
    checkRatings: [...ratings],
    scoredCount: scored.length,
    totalCount: ratings.length,
  };
}

/**
 * Weighted mean, rounded to one decimal. Returns null for an empty set — a
 * score of "nothing measured" is null, distinct from a measured 0.
 */
function weightedMean(
  points: ReadonlyArray<{ value: number; weight: number }>,
): number | null {
  if (points.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const point of points) {
    weightedSum += point.value * point.weight;
    totalWeight += point.weight;
  }

  if (totalWeight === 0) return null;

  return Number((weightedSum / totalWeight).toFixed(1));
}

/**
 * Maps a 0–100 score to a coarse band, for colour and label in the UI.
 * Kept here so band boundaries are defined once alongside the math.
 */
export type ScoreBand = "strong" | "solid" | "developing" | "needs_work";

export function scoreBand(score: number | null): ScoreBand | null {
  if (score === null) return null;
  if (score >= 85) return "strong";
  if (score >= 70) return "solid";
  if (score >= 50) return "developing";
  return "needs_work";
}
