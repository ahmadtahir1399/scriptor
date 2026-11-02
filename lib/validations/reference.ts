import { z } from "zod";

/**
 * Reference-health validation.
 *
 * Two very different trust boundaries meet here, and both are validated with the
 * same zod discipline:
 *   1. MODEL output — the parsed bibliography entry. The model returns JSON, but
 *      "valid JSON" is not "the shape we store"; a missing field becomes a
 *      constraint violation three tables later without this gate.
 *   2. EXTERNAL API output — Crossref/OpenAlex/etc. This is untrusted input from
 *      the public internet. Every field is validated and every response is
 *      capped before a single value touches the database.
 *
 * Nothing here writes a hand-rolled string union: the DB enums come from
 * `lib/db/enums.ts`, and these local vocabularies (reference type, citation
 * family, provider name) are the ones with no database column behind them.
 */

// ---------------------------------------------------------------------------
// Local vocabularies (no DB enum — these never leave the reference feature)
// ---------------------------------------------------------------------------

export const REFERENCE_TYPES = [
  "article",
  "book",
  "chapter",
  "standard",
  "grey",
  "web",
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];
export const referenceTypeSchema = z.enum(REFERENCE_TYPES);

/** The two in-text citation families the extractor understands. */
export const CITATION_FAMILIES = ["author-date", "numeric"] as const;
export type CitationFamily = (typeof CITATION_FAMILIES)[number];
export const citationFamilySchema = z.enum(CITATION_FAMILIES);

/** Which external source produced a verification verdict. */
export const PROVIDER_NAMES = [
  "crossref",
  "openalex",
  "semantic_scholar",
  "open_library",
  "doi_org",
  "url_head",
] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];
export const providerNameSchema = z.enum(PROVIDER_NAMES);

/**
 * Evidence codes — WHY a reference got its verdict, stored in
 * `bibliography_references.health_detail` and localised in the UI.
 *
 * The detail column is encoded as `"<code>:<source>"` (source may be empty),
 * so the component can render a translated sentence and name the provider
 * without a prose string ever being hard-coded server-side. `parseHealthDetail`
 * and `encodeHealthDetail` are the only two places that know that format.
 */
export const EVIDENCE_CODES = [
  "verified_provider",
  "verified_doi",
  "verified_url",
  "needs_correction_title",
  "broken_doi",
  "broken_url",
  "not_found",
  "unchecked_type",
  "unchecked_no_signal",
] as const;
export type EvidenceCode = (typeof EVIDENCE_CODES)[number];

export function encodeHealthDetail(
  code: EvidenceCode,
  source: ProviderName | null,
): string {
  return `${code}:${source ?? ""}`;
}

export function parseHealthDetail(detail: string | null): {
  code: EvidenceCode | null;
  source: ProviderName | null;
} {
  if (!detail) return { code: null, source: null };
  const [rawCode, rawSource] = detail.split(":");
  const code = (EVIDENCE_CODES as readonly string[]).includes(rawCode ?? "")
    ? (rawCode as EvidenceCode)
    : null;
  const source = (PROVIDER_NAMES as readonly string[]).includes(rawSource ?? "")
    ? (rawSource as ProviderName)
    : null;
  return { code, source };
}

// ---------------------------------------------------------------------------
// Model output — one parsed bibliography entry
// ---------------------------------------------------------------------------

/**
 * The structured form of one reference-list block, as the EXTRACTION model is
 * asked to return it. Everything except `type` is nullable: a reference-list is
 * a mess of styles and a missing DOI or year is normal, not an error.
 */
export const parsedBibliographyEntrySchema = z.object({
  authors: z.array(z.string().trim().min(1)).max(50).default([]),
  year: z.string().trim().min(1).max(12).nullable().default(null),
  title: z.string().trim().min(1).max(1000).nullable().default(null),
  container: z.string().trim().min(1).max(500).nullable().default(null),
  publisher: z.string().trim().min(1).max(500).nullable().default(null),
  volume: z.string().trim().min(1).max(50).nullable().default(null),
  issue: z.string().trim().min(1).max(50).nullable().default(null),
  pages: z.string().trim().min(1).max(50).nullable().default(null),
  doi: z.string().trim().min(1).max(300).nullable().default(null),
  url: z.string().trim().min(1).max(2000).nullable().default(null),
  isbn: z.string().trim().min(1).max(30).nullable().default(null),
  type: referenceTypeSchema.default("article"),
});
export type ParsedBibliographyEntry = z.infer<
  typeof parsedBibliographyEntrySchema
>;

/** Wrapper the parse prompt returns — one entry, plus the detected style. */
export const bibliographyParseResponseSchema = z.object({
  entry: parsedBibliographyEntrySchema,
});
export type BibliographyParseResponse = z.infer<
  typeof bibliographyParseResponseSchema
>;

// ---------------------------------------------------------------------------
// External API output — the normalised shape every provider returns
// ---------------------------------------------------------------------------

/**
 * The ONE shape every provider adapter returns. No provider-specific field ever
 * leaks past its adapter — a caller cannot tell Crossref from OpenAlex from this
 * type, which is the entire point of the uniform interface.
 */
export const providerRecordSchema = z.object({
  found: z.boolean(),
  title: z.string().nullable().default(null),
  authors: z.array(z.string()).default([]),
  year: z.string().nullable().default(null),
  doi: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  source: providerNameSchema,
});
export type ProviderRecord = z.infer<typeof providerRecordSchema>;

// ---------------------------------------------------------------------------
// Server-action inputs (client → server; treat as hostile)
// ---------------------------------------------------------------------------

/** Marks one reconciliation orphan (either side) as resolved by the student. */
export const resolvePairSchema = z.object({
  analysisId: z.string().uuid(),
  pairId: z.string().uuid(),
});
export type ResolvePairInput = z.infer<typeof resolvePairSchema>;

/** Re-queues verification for a single bibliography reference. */
export const recheckReferenceSchema = z.object({
  analysisId: z.string().uuid(),
  referenceId: z.string().uuid(),
});
export type RecheckReferenceInput = z.infer<typeof recheckReferenceSchema>;

/** Re-runs the whole verification pass (the "Retry verification" button). */
export const retryVerificationSchema = z.object({
  analysisId: z.string().uuid(),
});
export type RetryVerificationInput = z.infer<typeof retryVerificationSchema>;
