/**
 * Reference-health configuration.
 *
 * Every tunable for the citation-health pipeline lives here — timeouts, retry
 * budgets, concurrency caps, the similarity threshold that decides VERIFIED vs
 * NEEDS_CORRECTION, and the entry caps that stop a pathological bibliography
 * from firing hundreds of external requests. Nothing in a provider or handler
 * hard-codes a number that belongs in this file.
 */

/** Fixed project contact used in the polite-pool `mailto`, when env is unset. */
export const DEFAULT_VERIFICATION_MAILTO = "references@scriptor.app";

/** A stable, honest User-Agent string. The URL and mailto are the etiquette. */
export function buildUserAgent(mailto: string): string {
  return `Scriptor/1.0 (+https://scriptor.app; mailto:${mailto})`;
}

/** Per-request network behaviour, shared by every provider adapter. */
export const PROVIDER_HTTP = {
  /** Hard timeout for a single external request. */
  timeoutMs: 8000,
  /** Retries on 429 / 5xx before giving up on a provider. */
  maxRetries: 2,
  /** Base backoff; doubled each retry, honouring Retry-After when present. */
  backoffBaseMs: 600,
  /** Cap on a response body we will read, in bytes — external input is untrusted. */
  maxResponseBytes: 2_000_000,
} as const;

/** How many references we verify at once. Politeness first, latency second. */
export const VERIFY_CONCURRENCY = 4;

/** How many bibliography blocks we parse with the model at once. */
export const PARSE_CONCURRENCY = 5;

/**
 * Hard caps. A document with thousands of "references" is either malformed or
 * adversarial; either way we bound the work rather than melt the queue.
 */
export const REFERENCE_LIMITS = {
  maxBibliographyEntries: 300,
  maxInTextCitations: 2000,
  /** Longest raw reference block we will send to the parser. */
  maxRawEntryChars: 2000,
} as const;

/**
 * Title-agreement threshold. At or above this Jaccard-ish similarity a provider
 * record is accepted as the SAME work (→ VERIFIED); below it, the DOI resolves
 * but points somewhere else (→ NEEDS_CORRECTION). Deliberately forgiving of
 * subtitle and punctuation drift, strict about a genuinely different paper.
 */
export const TITLE_MATCH_THRESHOLD = 0.6;

/**
 * Floor below which a SEARCH result is not about the cited work at all.
 *
 * A title search never fails: Crossref, OpenAlex and Semantic Scholar all rank
 * their corpus against the query and hand back a best guess no matter how
 * unrelated it is. Taking that guess unconditionally made two of this feature's
 * verdicts unreachable — a wholly fabricated reference came back
 * NEEDS_CORRECTION against a real paper it has nothing to do with (measured:
 * 0.371 and 0.135 similarity), and NOT_FOUND could never be reached at all.
 *
 * So a search hit has to clear this bar before it counts as a candidate.
 * Between here and TITLE_MATCH_THRESHOLD is the genuine "close, but titled
 * differently" band; below it there is no candidate and the verdict falls
 * through to NOT_FOUND, or to UNCHECKED for the types that deserve it.
 *
 * A DOI or ISBN lookup is exempt — those are exact identifiers, and a DOI that
 * resolves to a different title is precisely the NEEDS_CORRECTION this feature
 * exists to catch, not noise to be filtered.
 */
export const TITLE_SEARCH_FLOOR = 0.5;

/** Reference types we never mark NOT_FOUND — absence from a DB isn't proof. */
export const UNVERIFIABLE_TYPES = ["standard", "grey"] as const;

/** In-run memo cache bound, so a huge run cannot grow the cache without limit. */
export const PROVIDER_CACHE_MAX_ENTRIES = 1000;
