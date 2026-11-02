import "server-only";

import type { AppLocale } from "@/lib/db/enums";
import type { CheckVersion } from "@/lib/domain/check";
import { getCheckVersion } from "@/lib/db/queries/checks";
import { getActiveAbTest } from "@/lib/db/queries/checks";
import type { Db } from "@/lib/db/queries/papers";

/**
 * A/B test selection — schema-ready, deliberately minimal logic.
 *
 * P1 built `check_ab_tests` and the `hidden_because_ab_test` flag. The full
 * experiment UI is P15/P16. Here we only honour the data model so nothing needs
 * reworking later: if an active A/B test exists for a check, pick one arm
 * deterministically per analysis, record which, and mark the result's
 * visibility. If no test exists, this returns null and the caller uses the
 * single active version.
 */

export interface AbSelection {
  version: CheckVersion;
  abTestId: string;
  /**
   * True when the chosen arm is the one the student should NOT see. In a live
   * test both arms run for evaluation; only the control is shown, so a variant
   * result is written hidden. Here we treat the control arm as visible.
   */
  hiddenBecauseAbTest: boolean;
}

/**
 * Chooses an arm for an analysis, or null when there is no active test.
 *
 * Selection is DETERMINISTIC per analysis: the same analysis id always maps to
 * the same arm, so a retried job cannot flip arms mid-analysis and produce two
 * inconsistent result rows. `traffic_percent` sets the split.
 */
export async function selectCheckVersion(
  db: Db,
  checkId: string,
  _locale: AppLocale,
  analysisId: string,
): Promise<AbSelection | null> {
  const test = await getActiveAbTest(db, checkId);
  if (!test) return null;

  // Deterministic bucket from the analysis id — a stable hash in [0, 100).
  const bucket = hashToPercent(analysisId);
  const useVariant = bucket < test.traffic_percent;

  const chosenId = useVariant
    ? test.variant_version_id
    : test.control_version_id;
  const version = await getCheckVersion(db, chosenId);
  if (!version) return null;

  return {
    version,
    abTestId: test.id,
    // The variant arm is the hidden one; the control is what the student sees.
    hiddenBecauseAbTest: useVariant,
  };
}

/** Stable string → [0, 100). Simple FNV-1a; no crypto strength needed. */
function hashToPercent(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}
