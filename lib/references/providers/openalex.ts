import "server-only";

import { z } from "zod";

import {
  normaliseRecord,
  notFound,
  politeFetch,
  safeJson,
  withCache,
  type ProviderContext,
  type ReferenceProvider,
} from "@/lib/references/providers/index";
import { normaliseDoi } from "@/lib/references/providers/doiResolve";
import type { ProviderRecord } from "@/lib/validations/reference";

/**
 * OpenAlex adapter — https://api.openalex.org
 *
 * An open index of works, authors and venues. Polite pool via the `mailto`
 * query param. Complements Crossref: it often has a record for a work whose DOI
 * Crossref does not expose, and vice versa.
 *
 * PRIVACY: only the DOI or bibliographic string is sent — public data. Never the
 * thesis text, never the student's identity.
 */

const API = "https://api.openalex.org/works";
const SELECT =
  "id,doi,display_name,title,publication_year,authorships,primary_location";

const openAlexWorkSchema = z.object({
  doi: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  publication_year: z.number().nullable().optional(),
  authorships: z
    .array(
      z.object({
        author: z.object({ display_name: z.string().optional() }).optional(),
      }),
    )
    .optional(),
  primary_location: z
    .object({ landing_page_url: z.string().nullable().optional() })
    .nullable()
    .optional(),
});
type OpenAlexWork = z.infer<typeof openAlexWorkSchema>;

const listSchema = z.object({
  results: z.array(openAlexWorkSchema).optional(),
});

function toRecord(work: OpenAlexWork): ProviderRecord {
  const authors = (work.authorships ?? [])
    .map((entry) => entry.author?.display_name?.trim() ?? "")
    .filter((name) => name.length > 0);
  // OpenAlex stores the DOI as a full https://doi.org/... URL; normalise it back.
  const doi = work.doi ? normaliseDoi(work.doi) : null;

  return normaliseRecord(
    {
      found: true,
      title: work.display_name ?? work.title ?? null,
      authors,
      year: work.publication_year ? String(work.publication_year) : null,
      doi,
      url: work.primary_location?.landing_page_url ?? work.doi ?? null,
      source: "openalex",
    },
    "openalex",
  );
}

export const openalex: ReferenceProvider = {
  name: "openalex",

  async byDoi(rawDoi: string, ctx: ProviderContext): Promise<ProviderRecord> {
    const doi = normaliseDoi(rawDoi);
    if (!doi) return notFound("openalex");

    return withCache(ctx, "openalex", "doi", doi, async () => {
      // PRIVACY: only the DOI leaves the app here.
      const url = `${API}/doi:${encodeURIComponent(doi)}?select=${SELECT}&mailto=${encodeURIComponent(ctx.mailto)}`;
      const response = await politeFetch(url, {
        accept: "application/json",
        mailto: ctx.mailto,
        logProvider: "openalex",
        logTarget: doi,
      }).catch(() => null);

      if (!response || !response.ok) return notFound("openalex");
      const parsed = openAlexWorkSchema.safeParse(safeJson(response.text));
      if (!parsed.success) return notFound("openalex");
      return toRecord(parsed.data);
    });
  },

  async byQuery(query: string, ctx: ProviderContext): Promise<ProviderRecord> {
    const trimmed = query.trim();
    if (trimmed.length < 6) return notFound("openalex");

    return withCache(ctx, "openalex", "query", trimmed, async () => {
      // PRIVACY: only the reference's bibliographic string is sent — public data.
      const url =
        `${API}?search=${encodeURIComponent(trimmed)}` +
        `&per-page=3&select=${SELECT}&mailto=${encodeURIComponent(ctx.mailto)}`;
      const response = await politeFetch(url, {
        accept: "application/json",
        mailto: ctx.mailto,
        logProvider: "openalex",
        logTarget: trimmed,
      }).catch(() => null);

      if (!response || !response.ok) return notFound("openalex");
      const parsed = listSchema.safeParse(safeJson(response.text));
      const first = parsed.success ? parsed.data.results?.[0] : undefined;
      return first ? toRecord(first) : notFound("openalex");
    });
  },
};
