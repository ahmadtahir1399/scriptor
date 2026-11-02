import "server-only";

import type { ReferenceHealth } from "@/lib/db/enums";
import {
  TITLE_MATCH_THRESHOLD,
  TITLE_SEARCH_FLOOR,
  UNVERIFIABLE_TYPES,
} from "@/lib/references/config";
import { assessMatch } from "@/lib/references/matchTitle";
import { crossref } from "@/lib/references/providers/crossref";
import { openalex } from "@/lib/references/providers/openalex";
import { semanticScholar } from "@/lib/references/providers/semanticScholar";
import { openLibrary } from "@/lib/references/providers/openLibrary";
import { resolveDoi } from "@/lib/references/providers/doiResolve";
import {
  politeFetch,
  type ProviderContext,
  type ReferenceProvider,
} from "@/lib/references/providers/index";
import {
  encodeHealthDetail,
  type ProviderRecord,
  type ReferenceType,
} from "@/lib/validations/reference";

/**
 * Stage 3 — resolve one reference to a health verdict, cheapest signal first.
 *
 * The order is deliberate and matches the product's forensic promise: a DOI
 * that resolves is the strongest, cheapest evidence; a metadata match confirms
 * the DOI points at the CITED work (not merely *a* work); a book falls to Open
 * Library; a bare URL is HEAD-checked; and only after all of that does a source
 * become NOT_FOUND. Standards and grey literature never become NOT_FOUND —
 * absence from a database is not proof of non-existence for them.
 *
 * Returns the verdict plus an evidence code and the winning provider, encoded
 * for `health_detail`, and the resolved URL. Every verdict carries its reason.
 */

export interface VerifyInput {
  rawText: string;
  title: string | null;
  authors: string[];
  year: string | null;
  doi: string | null;
  url: string | null;
  isbn: string | null;
  type: ReferenceType;
}

/**
 * Infers a reference's type from its stored fields.
 *
 * The type is not a column on `bibliography_references`, so it is derived at
 * verification time from the shape of what WAS stored — an ISBN or publisher
 * says book, a journal or DOI says article, an ISO/DIN number says standard.
 * The type only matters for the last step: standards and grey literature must
 * degrade to UNCHECKED, never a false NOT_FOUND.
 */
export function inferReferenceType(row: {
  raw_text: string;
  doi: string | null;
  url: string | null;
  isbn: string | null;
  journal: string | null;
  publisher: string | null;
}): ReferenceType {
  const raw = row.raw_text.toLowerCase();
  if (/\b(iso|din|en|iec|astm|ieee std|bs)\s?\d/i.test(row.raw_text))
    return "standard";
  if (row.isbn) return "book";
  if (
    /\b(working paper|technical report|preprint|dissertation|thesis|mimeo|discussion paper)\b/.test(
      raw,
    )
  ) {
    return "grey";
  }
  if (/\bin:\s/.test(raw) || /\b(eds?|hrsg)\.?\b/.test(raw)) return "chapter";
  if (row.journal || row.doi) return "article";
  if (row.publisher) return "book";
  if (row.url) return "web";
  return "article";
}

export interface VerifyVerdict {
  health: ReferenceHealth;
  /** Encoded "<code>:<source>" for health_detail; the UI localises it. */
  detail: string;
  resolvedUrl: string | null;
}

const METADATA_PROVIDERS: readonly ReferenceProvider[] = [
  crossref,
  openalex,
  semanticScholar,
];

export async function verifyReference(
  input: VerifyInput,
  ctx: ProviderContext,
): Promise<VerifyVerdict> {
  // 1. DOI resolution — the decisive, cheap first check.
  let resolvedUrl: string | null = null;
  if (input.doi) {
    const resolution = await resolveDoi(input.doi, ctx.mailto);
    /*
     * Only 404/410 accuses the citation. Every other 4xx is doi.org declining to
     * answer US — a 429 when the polite pool throttles, a 403 if the resolver
     * ever fronts a bot filter — and answering "this DOI is fabricated" to
     * "please slow down" is the most damaging thing this feature can do to a
     * student. Same rule as reachabilityFromStatus below; anything short of a
     * definite "not here" falls through to the metadata providers.
     */
    if (
      !resolution.resolves &&
      (resolution.status === 404 || resolution.status === 410)
    ) {
      // A DOI that 404s is fabricated or mistyped — the headline catch.
      return {
        health: "BROKEN_URL",
        detail: encodeHealthDetail("broken_doi", "doi_org"),
        resolvedUrl: null,
      };
    }
    resolvedUrl = resolution.finalUrl;
  }

  // 2. Metadata match — confirm the record is the SAME work that was cited.
  const candidate = await findMetadata(input, ctx);
  if (candidate) {
    const assessment = assessMatch(
      { title: input.title, authors: input.authors },
      { title: candidate.record.title, authors: candidate.record.authors },
      TITLE_MATCH_THRESHOLD,
    );

    if (assessment.isSameWork || input.title === null) {
      return {
        health: "VERIFIED",
        detail: encodeHealthDetail(
          "verified_provider",
          candidate.record.source,
        ),
        resolvedUrl: candidate.record.url ?? resolvedUrl,
      };
    }

    // Resolves, but to a DIFFERENT paper than the cited title — the subtle one.
    return {
      health: "NEEDS_CORRECTION",
      detail: encodeHealthDetail(
        "needs_correction_title",
        candidate.record.source,
      ),
      resolvedUrl: candidate.record.url ?? resolvedUrl,
    };
  }

  // 3. The DOI resolved but no provider had metadata — still real and reachable.
  if (resolvedUrl) {
    return {
      health: "VERIFIED",
      detail: encodeHealthDetail("verified_doi", "doi_org"),
      resolvedUrl,
    };
  }

  // 4. A bare URL, no DOI — is it at least reachable?
  if (input.url && !input.doi) {
    const reachable = await headUrl(input.url, ctx.mailto);
    if (reachable === true) {
      return {
        health: "VERIFIED",
        detail: encodeHealthDetail("verified_url", "url_head"),
        resolvedUrl: input.url,
      };
    }
    if (reachable === false) {
      return {
        health: "BROKEN_URL",
        detail: encodeHealthDetail("broken_url", "url_head"),
        resolvedUrl: null,
      };
    }
    // reachable === null → network error; fall through to the type-aware ending.
  }

  // 5. Nothing resolved. Standards and grey literature degrade to UNCHECKED with
  //    a reason rather than a false NOT_FOUND.
  if ((UNVERIFIABLE_TYPES as readonly string[]).includes(input.type)) {
    return {
      health: "UNCHECKED",
      detail: encodeHealthDetail("unchecked_type", null),
      resolvedUrl: null,
    };
  }
  if (!input.doi && !input.isbn && !input.url && input.title === null) {
    return {
      health: "UNCHECKED",
      detail: encodeHealthDetail("unchecked_no_signal", null),
      resolvedUrl: null,
    };
  }

  return {
    health: "NOT_FOUND",
    detail: encodeHealthDetail("not_found", null),
    resolvedUrl: null,
  };
}

interface MetadataHit {
  record: ProviderRecord;
}

/** Tries DOI lookup, then title search, then book providers, in cost order. */
async function findMetadata(
  input: VerifyInput,
  ctx: ProviderContext,
): Promise<MetadataHit | null> {
  if (input.doi) {
    for (const provider of METADATA_PROVIDERS) {
      const record = provider.byDoi
        ? await provider.byDoi(input.doi, ctx)
        : null;
      if (record?.found) return { record };
    }
  }

  const query = buildQuery(input);
  if (query) {
    for (const provider of METADATA_PROVIDERS) {
      const record = provider.byQuery
        ? await provider.byQuery(query, ctx)
        : null;
      if (record?.found && isPlausibleSearchHit(input, record)) {
        return { record };
      }
    }
  }

  // Books: ISBN first, then a title search on Open Library.
  if (input.isbn && openLibrary.byIsbn) {
    const record = await openLibrary.byIsbn(input.isbn, ctx);
    if (record.found) return { record };
  }
  if (
    (input.type === "book" || input.type === "chapter") &&
    input.title &&
    openLibrary.byQuery
  ) {
    const record = await openLibrary.byQuery(input.title, ctx);
    if (record.found && isPlausibleSearchHit(input, record)) {
      return { record };
    }
  }

  return null;
}

/**
 * Is this search result about the cited work at all?
 *
 * Applied ONLY to results that came back from a title search, never to a DOI or
 * ISBN lookup. See TITLE_SEARCH_FLOOR: a search engine's best guess is not
 * evidence of anything on its own, and treating it as evidence is what let a
 * fabricated reference be reported against a real, unrelated paper.
 */
function isPlausibleSearchHit(
  input: VerifyInput,
  record: ProviderRecord,
): boolean {
  if (input.title === null) return false;

  const { similarity, authorsAgree } = assessMatch(
    { title: input.title, authors: input.authors },
    { title: record.title, authors: record.authors },
    TITLE_MATCH_THRESHOLD,
  );

  // Agreeing authors buy the same slack here as they do at the main threshold.
  return (
    similarity >= TITLE_SEARCH_FLOOR ||
    (authorsAgree && similarity >= TITLE_SEARCH_FLOOR - 0.15)
  );
}

function buildQuery(input: VerifyInput): string | null {
  if (!input.title) return null;
  const parts = [input.title];
  if (input.authors[0]) parts.push(input.authors[0]);
  if (input.year) parts.push(input.year);
  return parts.join(" ").trim();
}

/**
 * Classifies an HTTP status as evidence about whether a cited page still exists.
 *
 * The distinction that matters is GONE versus BLOCKED, and `response.ok` cannot
 * make it. Only 404 and 410 mean the publisher is telling us the resource is
 * not there. A 401/403/429 means we were refused — which is a statement about
 * our User-Agent, not about the citation.
 *
 * Measured against the app's own User-Agent: of ten live citation targets,
 * oecd.org, sciencedirect.com and tandfonline.com all answer 403 to a HEAD from
 * a non-browser client. Under the old `return response.ok` every one of those
 * was shown to the student as BROKEN_URL — three false accusations in ten, on
 * exactly the publishers a thesis is most likely to cite.
 *
 * 5xx is the same kind of non-evidence: a publisher having a bad day is not a
 * broken citation. Both degrade to `null`, which makes the caller fall through
 * to the type-aware ending rather than assert anything it cannot support.
 */
function reachabilityFromStatus(status: number): boolean | null {
  if (status >= 200 && status < 400) return true;
  if (status === 404 || status === 410) return false;
  return null;
}

/** HEAD a bare URL. true = reachable, false = gone, null = no usable evidence. */
async function headUrl(url: string, mailto: string): Promise<boolean | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    // PRIVACY: only the reference's own URL is requested — never the thesis text.
    const response = await politeFetch(url, {
      method: "HEAD",
      redirect: "follow",
      mailto,
      logProvider: "url_head",
      logTarget: url,
    });

    /*
     * Some servers reject HEAD outright, and some reject it specifically for
     * bots while serving GET — so a refusal is worth one GET before giving up.
     * Retrying only on 405/501 missed the 403 case entirely.
     */
    if (
      response.status === 405 ||
      response.status === 501 ||
      response.status === 403
    ) {
      const getResponse = await politeFetch(url, {
        method: "GET",
        redirect: "follow",
        mailto,
        logProvider: "url_head",
        logTarget: url,
      });
      return reachabilityFromStatus(getResponse.status);
    }

    return reachabilityFromStatus(response.status);
  } catch {
    return null;
  }
}
