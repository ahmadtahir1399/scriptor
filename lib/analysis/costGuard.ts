import "server-only";

import { MAX_ANALYSIS_COST_USD, COST_ESTIMATE } from "@/lib/analysis/config";
import {
  cancelPendingCheckJobs,
  getAnalysisCostSoFar,
  setAnalysisError,
} from "@/lib/db/queries/analyses";
import type { Db } from "@/lib/db/queries/papers";

/**
 * The ceiling that stops a runaway.
 *
 * Checked BEFORE each check's model call, against the summed
 * `token_usage.cost_usd` for the analysis. If caching silently breaks and a
 * $0.40 analysis starts heading for $4, this is what catches it — the cost
 * column is the only place a cache regression is visible, and this is the code
 * that acts on it.
 */

export const COST_CEILING_REASON = "COST_CEILING";

export interface CostCheck {
  exceeded: boolean;
  spentUsd: number;
  ceilingUsd: number;
}

/**
 * Returns whether the analysis has already crossed the ceiling.
 *
 * A read, not a mutation — the handler decides what to do. Kept separate so the
 * decision to abort is explicit at the call site rather than a hidden side
 * effect of asking the cost.
 */
export async function checkCostCeiling(
  db: Db,
  analysisId: string,
): Promise<CostCheck> {
  const spentUsd = await getAnalysisCostSoFar(db, analysisId);
  return {
    exceeded: spentUsd >= MAX_ANALYSIS_COST_USD,
    spentUsd,
    ceilingUsd: MAX_ANALYSIS_COST_USD,
  };
}

/**
 * Aborts the analysis for cost.
 *
 * Cancels the remaining check jobs, marks the analysis ERROR with reason
 * COST_CEILING, and — crucially — LEAVES the already-completed check_results in
 * place. The student sees "We completed 6 of 9 checks", not a blank failure.
 * Partial value beats nothing.
 */
export async function abortForCost(db: Db, analysisId: string): Promise<void> {
  await cancelPendingCheckJobs(db, analysisId, COST_CEILING_REASON);
  await setAnalysisError(
    db,
    analysisId,
    COST_CEILING_REASON,
    "Analysis stopped after reaching its cost limit; completed checks are shown.",
  );
}

/**
 * Pre-flight estimate written to the analysis before any work runs.
 *
 * Deliberately an overestimate: the first ALL_PAGES check pays full price for
 * the body, the rest are mostly cache hits, plus a flat feedback cost each and
 * a per-page cost for individual-page checks.
 */
export function estimateAnalysisCost(args: {
  wordCount: number;
  allPagesCheckCount: number;
  individualPageCount: number;
}): number {
  const thousands = Math.max(1, args.wordCount / 1000);

  const firstCheck =
    args.allPagesCheckCount > 0
      ? thousands * COST_ESTIMATE.perThousandWordsFirstCheck
      : 0;

  const cachedChecks =
    Math.max(0, args.allPagesCheckCount - 1) *
    thousands *
    COST_ESTIMATE.perThousandWordsCachedCheck;

  const feedback = args.allPagesCheckCount * COST_ESTIMATE.feedbackPerCheck;

  const individual = args.individualPageCount * COST_ESTIMATE.perIndividualPage;

  return Number((firstCheck + cachedChecks + feedback + individual).toFixed(6));
}
