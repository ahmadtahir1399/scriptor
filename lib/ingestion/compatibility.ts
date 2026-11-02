import type { PageType } from "@/lib/db/enums";

/**
 * Compatibility gate.
 *
 * Entirely deterministic — no model call. This runs before the student has
 * committed to anything, so it must be free and instant. It is also the last
 * honest moment: past this point we start spending money on their document.
 *
 * Pure function, no I/O, so every rule is unit-testable without a database.
 */

export const INCOMPATIBILITY_REASONS = [
  "SCANNED_PDF",
  "TOO_SHORT",
  "TOO_LONG",
  "EXCEEDS_TYPE_LIMIT",
  "TOO_MANY_PAGES",
  "NO_BODY_CONTENT",
  "UNREADABLE",
] as const;

export type IncompatibilityReason = (typeof INCOMPATIBILITY_REASONS)[number];

export const COMPATIBILITY_LIMITS = {
  /** Below this many extracted characters per page, it is almost certainly a scan. */
  minCharsPerPage: 100,
  minWords: 500,
  maxWords: 48_000,
  maxPages: 300,
} as const;

export interface CompatibilityInput {
  pageCount: number;
  totalWords: number;
  totalChars: number;
  pageTypes: readonly PageType[];
  /** From the chosen document_type. */
  maxCharsForType: number;
}

export type CompatibilityVerdict =
  { compatible: true } | { compatible: false; reason: IncompatibilityReason };

/**
 * Evaluates an upload.
 *
 * Order matters. UNREADABLE and SCANNED_PDF are checked first because they
 * explain every other symptom — a scanned thesis is also "too short", and
 * telling a student their 200-page dissertation is too short would be both
 * wrong and insulting.
 */
export function evaluateCompatibility(
  input: CompatibilityInput,
): CompatibilityVerdict {
  // Nothing came out at all.
  if (input.totalWords === 0 || input.totalChars === 0) {
    return { compatible: false, reason: "UNREADABLE" };
  }

  /*
   * The highest-value rule in this file. A scanned PDF is the single most
   * common failure mode for academic tools, and without this check it produces
   * a garbage analysis that looks like the product is broken rather than like
   * the file is unsuitable. Catching it here turns that into one honest
   * sentence with a fix the student can act on.
   */
  if (input.pageCount > 0) {
    const charsPerPage = input.totalChars / input.pageCount;
    if (charsPerPage < COMPATIBILITY_LIMITS.minCharsPerPage) {
      return { compatible: false, reason: "SCANNED_PDF" };
    }
  }

  if (input.pageCount > COMPATIBILITY_LIMITS.maxPages) {
    return { compatible: false, reason: "TOO_MANY_PAGES" };
  }

  if (input.totalWords < COMPATIBILITY_LIMITS.minWords) {
    return { compatible: false, reason: "TOO_SHORT" };
  }

  if (input.totalWords > COMPATIBILITY_LIMITS.maxWords) {
    return { compatible: false, reason: "TOO_LONG" };
  }

  if (input.totalChars > input.maxCharsForType) {
    return { compatible: false, reason: "EXCEEDS_TYPE_LIMIT" };
  }

  // Every check is scoped to a page type; with no BODY pages there is nothing
  // for any of them to read.
  if (!input.pageTypes.includes("BODY")) {
    return { compatible: false, reason: "NO_BODY_CONTENT" };
  }

  return { compatible: true };
}

/**
 * Message key for a reason.
 *
 * Returns a key, never a sentence — every user-facing string lives in
 * `messages/{locale}.json`, including these.
 */
export function reasonMessageKey(reason: IncompatibilityReason): string {
  return `upload.incompatible.${reason}`;
}
