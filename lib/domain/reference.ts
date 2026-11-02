import type { Tables } from "@/lib/db/types.generated";
import type { ReferenceHealth } from "@/lib/db/enums";

/** Reference health aggregate — P9. */

export type InTextReference = Tables<"in_text_references">;
export type BibliographyReference = Tables<"bibliography_references">;
export type ReferencePair = Tables<"reference_pairs">;

/** A pair with both sides resolved. Either may be null — that is the point. */
export interface ResolvedReferencePair extends ReferencePair {
  in_text_reference: InTextReference | null;
  bibliography_reference: BibliographyReference | null;
}

/**
 * The three kinds of pair, as a discriminated union.
 *
 * Returning this instead of raw booleans forces the caller to handle the
 * orphan cases, which are the entire product value of this feature — a matched
 * pair is unremarkable, an orphan is a finding the student must act on.
 */
export type ReferenceMatch =
  | {
      kind: "matched";
      inText: InTextReference;
      bibliography: BibliographyReference;
      confidence: number | null;
    }
  | { kind: "uncited_bibliography"; bibliography: BibliographyReference }
  | { kind: "missing_bibliography"; inText: InTextReference };

export function classifyPair(
  pair: ResolvedReferencePair,
): ReferenceMatch | null {
  const { in_text_reference: inText, bibliography_reference: bibliography } =
    pair;

  if (inText && bibliography) {
    return {
      kind: "matched",
      inText,
      bibliography,
      confidence: pair.match_confidence,
    };
  }
  if (bibliography) {
    return { kind: "uncited_bibliography", bibliography };
  }
  if (inText) {
    return { kind: "missing_bibliography", inText };
  }

  // Unreachable: reference_pairs_at_least_one_side forbids it at the database
  // level. Handled anyway so a future schema change cannot fail silently.
  return null;
}

export interface ReferenceHealthSummary {
  total: number;
  verified: number;
  needsCorrection: number;
  brokenUrl: number;
  notFound: number;
  unchecked: number;
  uncitedEntries: number;
  missingEntries: number;
}

export function summariseHealth(
  bibliography: readonly BibliographyReference[],
  pairs: readonly ResolvedReferencePair[],
): ReferenceHealthSummary {
  const count = (health: ReferenceHealth): number =>
    bibliography.filter((entry) => entry.health === health).length;

  return {
    total: bibliography.length,
    verified: count("VERIFIED"),
    needsCorrection: count("NEEDS_CORRECTION"),
    brokenUrl: count("BROKEN_URL"),
    notFound: count("NOT_FOUND"),
    unchecked: count("UNCHECKED"),
    uncitedEntries: pairs.filter((p) => p.is_orphan_bibliography).length,
    missingEntries: pairs.filter((p) => p.is_orphan_in_text).length,
  };
}

/**
 * Maps reference health onto the app's semantic colour contract:
 * green = verified, amber = needs review, red = problem, muted = unknown.
 */
export function healthTone(
  health: ReferenceHealth,
): "verified" | "warning" | "critical" | "muted" {
  switch (health) {
    case "VERIFIED":
      return "verified";
    case "NEEDS_CORRECTION":
      return "warning";
    case "BROKEN_URL":
    case "NOT_FOUND":
      return "critical";
    case "UNCHECKED":
      return "muted";
  }
}
