import type { Tables, Views } from "@/lib/db/types.generated";
import type { AppLocale } from "@/lib/db/enums";

/**
 * Check catalogue aggregate.
 *
 * Two distinct read paths, and mixing them up is a security bug:
 *
 *   PublicCheck  — from `checks_public`. Safe for any authenticated user.
 *   Check        — the raw table. Requires MANAGE_CHECKS.
 *   CheckVersion — contains the prompts. Requires MANAGE_CHECK_VERSIONS and
 *                  must never be sent to a browser for an ordinary user.
 */

export type PublicCheck = Views<"checks_public">;
export type Check = Tables<"checks">;
export type CheckVersion = Tables<"check_versions">;
export type DocumentTypeCheck = Tables<"document_type_checks">;
export type CheckAbTest = Tables<"check_ab_tests">;

/** Admin-only composition, used by P16. */
export interface CheckWithVersions extends Check {
  check_versions: CheckVersion[];
}

/**
 * A check version with its prompts removed.
 *
 * Use this whenever version metadata must reach the client — for example
 * showing which version produced a result. The three prompt fields are omitted
 * at the type level so forgetting to strip them is a compile error rather than
 * a silent IP leak.
 */
export type CheckVersionSafe = Omit<
  CheckVersion,
  "analysis_prompt" | "feedback_prompt" | "test_prompt"
>;

export function stripPrompts(version: CheckVersion): CheckVersionSafe {
  const {
    analysis_prompt: _analysisPrompt,
    feedback_prompt: _feedbackPrompt,
    test_prompt: _testPrompt,
    ...safe
  } = version;
  return safe;
}

/** Localised display name, falling back to English. */
export function checkName(check: PublicCheck, locale: AppLocale): string {
  const name = locale === "DE" ? check.name_de : check.name_en;
  return name ?? check.name_en ?? "";
}

export function checkDescription(
  check: PublicCheck,
  locale: AppLocale,
): string {
  const description =
    locale === "DE" ? check.description_de : check.description_en;
  return description ?? check.description_en ?? "";
}

/**
 * A check is selectable only when it is active AND has an active version.
 * A check with no active version has no prompt to run and would fail at
 * dispatch — better to hide it than to enqueue work that cannot succeed.
 */
export function isSelectable(check: PublicCheck): boolean {
  return check.is_active === true && check.active_version_id !== null;
}
