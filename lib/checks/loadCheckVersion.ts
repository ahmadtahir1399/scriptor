import "server-only";

import type { AppLocale } from "@/lib/db/enums";
import type { CheckVersion } from "@/lib/domain/check";
import { resolveModelRole, type ModelRole } from "@/lib/ai/models";
import { getActiveCheckVersion } from "@/lib/db/queries/checks";
import { selectCheckVersion } from "@/lib/checks/abTest";
import type { Db } from "@/lib/db/queries/papers";

/**
 * Loads the check version a job will execute, and resolves its model.
 *
 * The version carries the prompt IP (`analysis_prompt`, `feedback_prompt`). It
 * is loaded here with the service-role client — P1's RLS keeps these columns
 * unreadable by users — and must never leave the worker. The returned object is
 * NOT safe to serialise to a client.
 */

export interface LoadedCheck {
  version: CheckVersion;
  /** Resolved role, so handler code never sees a raw model ID. */
  role: ModelRole;
  /** A/B test id when one was chosen, else null. */
  abTestId: string | null;
  /** Losing-arm flag for the resulting check_results row. */
  hiddenBecauseAbTest: boolean;
}

/**
 * Resolves the active version for a check + locale, honouring an A/B test.
 *
 * `check_versions.model` holds a ROLE NAME, resolved here through the role map.
 * That indirection is the whole point: re-routing a check to a cheaper model is
 * one database edit, and no handler ever contains a literal model ID.
 */
export async function loadCheckVersion(
  db: Db,
  checkId: string,
  locale: AppLocale,
  analysisId: string,
): Promise<LoadedCheck | null> {
  const selection = await selectCheckVersion(db, checkId, locale, analysisId);

  // Fall back to the single active version when no A/B test is configured.
  const version =
    selection?.version ?? (await getActiveCheckVersion(db, checkId, locale));

  if (!version) return null;

  return {
    version,
    role: resolveModelRole(version.model),
    abTestId: selection?.abTestId ?? null,
    hiddenBecauseAbTest: selection?.hiddenBecauseAbTest ?? false,
  };
}
