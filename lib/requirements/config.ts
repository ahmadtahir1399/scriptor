import type { PageType } from "@/lib/db/enums";

/**
 * Custom-requirements configuration.
 *
 * Every tunable for the requirements feature lives here — the active-requirement
 * ceiling (the seat for future tier gating), the fixed category vocabulary, the
 * extraction bounds, and the page scope each requirement category reads. No
 * magic numbers inline in a handler or component.
 */

/**
 * Ceiling on requirements applied to one analysis. Generous now; this is the one
 * place a future 18/45-requirement tier limit changes, with no other edits.
 */
export const MAX_ACTIVE_REQUIREMENTS = 100;

/** Whether supported requirements are pre-selected when applying to an upload. */
export const APPLY_CUSTOM_CHECKS_BY_DEFAULT = true;

/**
 * The fixed category vocabulary. Stored as free text on `requirements.category`
 * (the column is `text`, not an enum), but constrained to this set everywhere it
 * is written so the library can group reliably.
 */
export const REQUIREMENT_CATEGORIES = [
  "Formatting",
  "Structure",
  "Citation",
  "Content",
  "Length",
  "Language",
  "Other",
] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export function normaliseCategory(
  value: string | null | undefined,
): RequirementCategory {
  const match = REQUIREMENT_CATEGORIES.find(
    (category) => category.toLowerCase() === (value ?? "").trim().toLowerCase(),
  );
  return match ?? "Other";
}

/** Extraction bounds — a guidelines doc past these is malformed or adversarial. */
export const EXTRACTION_LIMITS = {
  /** Characters of guideline text sent to the model in one pass. */
  maxGuidelineChars: 60_000,
  /** Never emit more than this many requirements from one file. */
  maxRequirements: 120,
  /** Below this many characters a guidelines file is treated as empty/scanned. */
  minGuidelineChars: 200,
  maxOutputTokens: 4096,
} as const;

/**
 * Page scope a requirement reads at analysis time, by category.
 *
 * Most rules are about the body; structure and formatting rules also need the
 * front matter (cover, contents) and the reference list. Default BODY.
 */
export const REQUIREMENT_PAGE_SCOPE: Record<
  RequirementCategory,
  readonly PageType[]
> = {
  Formatting: ["COVER", "TOC", "BODY", "BIBLIOGRAPHY"],
  Structure: ["COVER", "ABSTRACT", "TOC", "BODY", "BIBLIOGRAPHY", "APPENDIX"],
  Citation: ["BODY", "BIBLIOGRAPHY"],
  Content: ["BODY"],
  Length: ["ABSTRACT", "BODY"],
  Language: ["BODY"],
  Other: ["BODY"],
};

export const DEFAULT_REQUIREMENT_SCOPE: readonly PageType[] = ["BODY"];
