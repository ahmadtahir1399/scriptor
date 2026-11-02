import "server-only";

import type { PageType } from "@/lib/db/enums";
import type { PaperPage } from "@/lib/domain/paper";
import { DEFAULT_PAGE_SCOPE, PAGE_SAMPLING } from "@/lib/analysis/config";

/**
 * Which pages a check reads, and how their text is assembled into the cacheable
 * document body.
 *
 * Two jobs live here because they must agree: the SAME page selection and the
 * SAME joining must be used for every check that shares a cache. If two checks
 * built the body even slightly differently — a different separator, a different
 * page order — the prefix would differ and the cache would never hit. So the
 * body is built in exactly one place: `buildScopedBody`.
 */

/** Filters pages to a check's declared scope. */
export function selectPagesForScope(
  pages: readonly PaperPage[],
  scope: readonly PageType[],
): PaperPage[] {
  const effective = scope.length > 0 ? scope : DEFAULT_PAGE_SCOPE;
  const wanted = new Set(effective);
  return pages
    .filter((page) => wanted.has(page.page_type))
    .sort((a, b) => a.page_number - b.page_number);
}

/**
 * Builds the document body string for a set of pages.
 *
 * BYTE-STABLE by construction: pages are always sorted by number, always joined
 * with the same delimiter, and the delimiter carries the page number so the
 * model can attribute a finding to a page. Because every ALL_PAGES check on an
 * upload passes the same scope, they all produce the identical string — which
 * is the entire basis of the cross-check cache hit.
 */
export function buildScopedBody(pages: readonly PaperPage[]): string {
  return pages
    .slice()
    .sort((a, b) => a.page_number - b.page_number)
    .map((page) => `[[page:${page.page_number}]]\n${page.page_content}`)
    .join("\n\n");
}

/**
 * Selects the BODY pages an INDIVIDUAL_PAGES check runs against.
 *
 * Below the threshold, every page. Above it, an EVENLY SPACED sample — first
 * and last always included, the rest spread across the document, so the sample
 * represents the whole thesis rather than just its opening. This cap is the
 * per-page fan-out limit; it is plausibly what a future Quick/Deep toggle sets.
 */
export function selectIndividualPages(
  pages: readonly PaperPage[],
): PaperPage[] {
  const bodyPages = pages
    .filter((page) => page.page_type === "BODY")
    .sort((a, b) => a.page_number - b.page_number);

  if (bodyPages.length <= PAGE_SAMPLING.threshold) {
    return bodyPages;
  }

  const target = PAGE_SAMPLING.maxSampledPages;
  const step = (bodyPages.length - 1) / (target - 1);

  const sampled: PaperPage[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < target; i += 1) {
    const index = Math.round(i * step);
    const page = bodyPages[index];
    if (page && !seen.has(page.page_number)) {
      seen.add(page.page_number);
      sampled.push(page);
    }
  }

  return sampled;
}
