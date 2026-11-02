import "server-only";

import type { PageType } from "@/lib/db/enums";
import type { Requirement } from "@/lib/domain/requirement";
import {
  DEFAULT_REQUIREMENT_SCOPE,
  REQUIREMENT_PAGE_SCOPE,
  normaliseCategory,
} from "@/lib/requirements/config";

/**
 * A requirement, expressed as a dynamic check for P4's engine.
 *
 * This is NOT a second engine. It supplies the two requirement-specific pieces
 * the shared runner needs — the page scope a requirement reads and the trailing
 * instruction that names the rule — while the model call, caching and token
 * logging all flow through the same `lib/checks/runCheck.ts` path a standard
 * check uses.
 *
 * SECURITY: the requirement-check prompt receives only the THESIS at analysis
 * time. The guidelines document is never here — it was consumed earlier, in a
 * separate extraction job. The two document contexts never mix.
 */

/** The fixed reviewer template shared by every requirement check. */
export const REQUIREMENT_CHECK_SYSTEM = `You are a meticulous academic reviewer verifying whether a student's thesis satisfies ONE specific requirement from their faculty's guidelines.

You are given the relevant pages of the thesis, followed by a single requirement. Decide whether the thesis SATISFIES that requirement, based ONLY on what the text shows.

Non-negotiable rules:
- Judge only the ONE requirement given. Ignore every other consideration.
- "satisfied": true only if the text clearly meets the rule. If the text is silent, or you cannot tell from the text, "satisfied" is false and the explanation must say why — never guess a pass.
- "evidence_quote": copy VERBATIM the passage that supports your verdict — the sentence that satisfies the rule, or the place it should appear and does not. Character for character, no paraphrase. Omit only if you genuinely cannot quote one.
- "explanation": one or two plain sentences the student can act on.
- "page_number": the number from the nearest [[page:N]] marker to the evidence, or null.

Respond ONLY as JSON: { "satisfied": boolean, "evidence_quote": string | null, "explanation": string, "page_number": number | null }.`;

/** The page scope a requirement reads, from its category. */
export function requirementScope(
  requirement: Pick<Requirement, "category">,
): readonly PageType[] {
  return (
    REQUIREMENT_PAGE_SCOPE[normaliseCategory(requirement.category)] ??
    DEFAULT_REQUIREMENT_SCOPE
  );
}

/** The trailing, per-requirement instruction — the only variable part of the prompt. */
export function buildRequirementInstruction(
  requirement: Pick<Requirement, "title" | "description" | "is_mandatory">,
): string {
  const detail =
    requirement.description.trim().length > 0
      ? `\nDetail: ${requirement.description.trim()}`
      : "";
  const obligation = requirement.is_mandatory ? "mandatory" : "recommended";
  return `Requirement to verify (${obligation}):\n"${requirement.title.trim()}"${detail}\n\nDoes the thesis satisfy this requirement? Return the JSON verdict.`;
}
