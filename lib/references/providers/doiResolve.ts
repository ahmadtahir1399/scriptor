import "server-only";

import { politeFetch } from "@/lib/references/providers/index";

/**
 * DOI resolution — the cheapest, most decisive signal there is.
 *
 * We ask doi.org to resolve the DOI and read ITS answer, without following the
 * redirect to the publisher. A 3xx with a `Location` means the DOI is
 * registered; a 404 means it is fabricated or mistyped, which is exactly the
 * "citation that looks real but isn't" case this whole feature exists to catch.
 *
 * ---------------------------------------------------------------------------
 * DO NOT change this back to `redirect: "follow"` + `response.ok`.
 *
 * That is what it used to do, and it made the verdict depend on whether the
 * PUBLISHER tolerates bots rather than on whether the DOI exists. Measured
 * against doi.org: `10.1037/0033-295X.84.2.191` — Bandura 1977, one of the most
 * cited papers in psychology — follows through to APA's PsycNET and comes back
 * **403** from a bot wall, so `response.ok` was false and a real, correctly
 * cited work was reported as unresolvable. Nature, Elsevier and PLOS happened
 * to answer 200, which is why this looked fine until a thesis cited APA, Wiley,
 * Sage or Taylor & Francis.
 *
 * Under `manual` the discriminator is exact and publisher-independent — every
 * real DOI tested returns 302 + Location, every fabricated one returns 404.
 * ---------------------------------------------------------------------------
 *
 * PRIVACY: only the DOI — public bibliographic data — is sent. No thesis text,
 * no user identity. (Comment repeated at every provider call site by design.)
 */

export interface DoiResolution {
  resolves: boolean;
  status: number;
  /** The publisher URL the DOI resolved to, when it resolved. */
  finalUrl: string | null;
}

/** Normalises the many ways a DOI is written down into a bare `10.x/...`. */
export function normaliseDoi(raw: string): string | null {
  const trimmed = raw.trim();
  // Strip a leading doi:, an https://doi.org/ prefix, or a dx.doi.org one.
  const stripped = trimmed
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .trim();
  // A DOI is `10.` followed by a registrant and a suffix.
  const match = stripped.match(/10\.\d{4,9}\/[^\s"<>]+/);
  return match ? match[0].replace(/[.,;]+$/, "") : null;
}

export async function resolveDoi(
  rawDoi: string,
  mailto: string,
): Promise<DoiResolution> {
  const doi = normaliseDoi(rawDoi);
  if (!doi) return { resolves: false, status: 0, finalUrl: null };

  const url = `https://doi.org/${encodeURI(doi)}`;

  // PRIVACY: only the DOI leaves the app here — never the surrounding thesis.
  // Try a cheap HEAD first; doi.org answers HEAD, but fall back to GET for the
  // handful of resolvers that reject it.
  let response = await politeFetch(url, {
    method: "HEAD",
    redirect: "manual",
    mailto,
    logProvider: "doi_org",
    logTarget: doi,
  }).catch(() => null);

  if (!response || response.status === 405 || response.status === 501) {
    response = await politeFetch(url, {
      method: "GET",
      redirect: "manual",
      mailto,
      logProvider: "doi_org",
      logTarget: doi,
    }).catch(() => null);
  }

  if (!response) return { resolves: false, status: 0, finalUrl: null };

  /*
   * A redirect is the success case, so `response.ok` — which is false for every
   * 3xx — cannot be the test. A 2xx still counts: a resolver that serves the
   * record directly rather than redirecting has also resolved the DOI.
   */
  const redirected = response.status >= 300 && response.status < 400;
  const resolves = redirected || response.ok;

  return {
    resolves,
    status: response.status,
    // Under `manual` the body is never fetched, so the publisher URL is
    // whatever doi.org named in `Location`.
    finalUrl: resolves ? (response.location ?? response.finalUrl) : null,
  };
}
