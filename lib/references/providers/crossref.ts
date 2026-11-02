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
 * Crossref adapter — https://api.crossref.org
 *
 * DOI metadata for the scholarly record. Uses the polite pool by sending the
 * project `mailto` as a query param (Crossref's documented etiquette, which
 * earns better rate limits).
 *
 * PRIVACY: only the DOI or the reference's bibliographic string is sent — public
 * data. Never the thesis text, never the student's identity.
 */

const API = "https://api.crossref.org/works";

// Only the fields we actually read. Everything is optional: an external body is
// untrusted, and Crossref omits fields freely.
const crossrefWorkSchema = z.object({
  DOI: z.string().optional(),
  URL: z.string().optional(),
  title: z.array(z.string()).optional(),
  "container-title": z.array(z.string()).optional(),
  author: z
    .array(
      z.object({ given: z.string().optional(), family: z.string().optional() }),
    )
    .optional(),
  issued: z
    .object({ "date-parts": z.array(z.array(z.number())).optional() })
    .optional(),
});
type CrossrefWork = z.infer<typeof crossrefWorkSchema>;

const singleSchema = z.object({ message: crossrefWorkSchema });
const listSchema = z.object({
  message: z.object({ items: z.array(crossrefWorkSchema).optional() }),
});

function toRecord(work: CrossrefWork): ProviderRecord {
  const authors = (work.author ?? [])
    .map((a) => [a.given, a.family].filter(Boolean).join(" ").trim())
    .filter((name) => name.length > 0);
  const year = work.issued?.["date-parts"]?.[0]?.[0];

  return normaliseRecord(
    {
      found: true,
      title: work.title?.[0] ?? null,
      authors,
      year: year ? String(year) : null,
      doi: work.DOI ?? null,
      url: work.URL ?? null,
      source: "crossref",
    },
    "crossref",
  );
}

export const crossref: ReferenceProvider = {
  name: "crossref",

  async byDoi(rawDoi: string, ctx: ProviderContext): Promise<ProviderRecord> {
    const doi = normaliseDoi(rawDoi);
    if (!doi) return notFound("crossref");

    return withCache(ctx, "crossref", "doi", doi, async () => {
      // PRIVACY: only the DOI leaves the app here.
      const url = `${API}/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(ctx.mailto)}`;
      const response = await politeFetch(url, {
        accept: "application/json",
        mailto: ctx.mailto,
        logProvider: "crossref",
        logTarget: doi,
      }).catch(() => null);

      if (!response || !response.ok) return notFound("crossref");
      const parsed = singleSchema.safeParse(safeJson(response.text));
      if (!parsed.success) return notFound("crossref");
      return toRecord(parsed.data.message);
    });
  },

  async byQuery(query: string, ctx: ProviderContext): Promise<ProviderRecord> {
    const trimmed = query.trim();
    if (trimmed.length < 6) return notFound("crossref");

    return withCache(ctx, "crossref", "query", trimmed, async () => {
      // PRIVACY: only the reference's bibliographic string is sent — public data.
      const url =
        `${API}?query.bibliographic=${encodeURIComponent(trimmed)}` +
        `&rows=3&select=DOI,URL,title,author,issued,container-title` +
        `&mailto=${encodeURIComponent(ctx.mailto)}`;
      const response = await politeFetch(url, {
        accept: "application/json",
        mailto: ctx.mailto,
        logProvider: "crossref",
        logTarget: trimmed,
      }).catch(() => null);

      if (!response || !response.ok) return notFound("crossref");
      const parsed = listSchema.safeParse(safeJson(response.text));
      const first = parsed.success ? parsed.data.message.items?.[0] : undefined;
      return first ? toRecord(first) : notFound("crossref");
    });
  },
};
