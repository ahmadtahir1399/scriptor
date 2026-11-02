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
 * Semantic Scholar adapter — https://api.semanticscholar.org/graph/v1
 *
 * Paper lookup by DOI or title. The public pool is rate-limited; `politeFetch`
 * backs off on 429. An optional API key (`SEMANTIC_SCHOLAR_API_KEY`) raises the
 * limit and is sent as `x-api-key` when present.
 *
 * PRIVACY: only the DOI or bibliographic string is sent — public data. Never the
 * thesis text, never the student's identity.
 */

const API = "https://api.semanticscholar.org/graph/v1/paper";
const FIELDS = "title,year,authors,externalIds,url";

const paperSchema = z.object({
  title: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  url: z.string().nullable().optional(),
  authors: z.array(z.object({ name: z.string().optional() })).optional(),
  externalIds: z
    .object({ DOI: z.string().nullable().optional() })
    .nullable()
    .optional(),
});
type Paper = z.infer<typeof paperSchema>;

const searchSchema = z.object({ data: z.array(paperSchema).optional() });

function toRecord(paper: Paper): ProviderRecord {
  const authors = (paper.authors ?? [])
    .map((a) => a.name?.trim() ?? "")
    .filter((name) => name.length > 0);

  return normaliseRecord(
    {
      found: true,
      title: paper.title ?? null,
      authors,
      year: paper.year ? String(paper.year) : null,
      doi: paper.externalIds?.DOI ? normaliseDoi(paper.externalIds.DOI) : null,
      url: paper.url ?? null,
      source: "semantic_scholar",
    },
    "semantic_scholar",
  );
}

export const semanticScholar: ReferenceProvider = {
  name: "semantic_scholar",

  async byDoi(rawDoi: string, ctx: ProviderContext): Promise<ProviderRecord> {
    const doi = normaliseDoi(rawDoi);
    if (!doi) return notFound("semantic_scholar");

    return withCache(ctx, "semantic_scholar", "doi", doi, async () => {
      // PRIVACY: only the DOI leaves the app here.
      const url = `${API}/DOI:${encodeURIComponent(doi)}?fields=${FIELDS}`;
      const response = await politeFetch(url, {
        accept: "application/json",
        mailto: ctx.mailto,
        apiKey: ctx.semanticScholarApiKey,
        apiKeyHeader: "x-api-key",
        logProvider: "semantic_scholar",
        logTarget: doi,
      }).catch(() => null);

      if (!response || !response.ok) return notFound("semantic_scholar");
      const parsed = paperSchema.safeParse(safeJson(response.text));
      if (!parsed.success) return notFound("semantic_scholar");
      return toRecord(parsed.data);
    });
  },

  async byQuery(query: string, ctx: ProviderContext): Promise<ProviderRecord> {
    const trimmed = query.trim();
    if (trimmed.length < 6) return notFound("semantic_scholar");

    return withCache(ctx, "semantic_scholar", "query", trimmed, async () => {
      // PRIVACY: only the reference's bibliographic string is sent — public data.
      const url = `${API}/search?query=${encodeURIComponent(trimmed)}&limit=3&fields=${FIELDS}`;
      const response = await politeFetch(url, {
        accept: "application/json",
        mailto: ctx.mailto,
        apiKey: ctx.semanticScholarApiKey,
        apiKeyHeader: "x-api-key",
        logProvider: "semantic_scholar",
        logTarget: trimmed,
      }).catch(() => null);

      if (!response || !response.ok) return notFound("semantic_scholar");
      const parsed = searchSchema.safeParse(safeJson(response.text));
      const first = parsed.success ? parsed.data.data?.[0] : undefined;
      return first ? toRecord(first) : notFound("semantic_scholar");
    });
  },
};
