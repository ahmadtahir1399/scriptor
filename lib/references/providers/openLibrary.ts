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
import type { ProviderRecord } from "@/lib/validations/reference";

/**
 * Open Library adapter — https://openlibrary.org
 *
 * Books, by ISBN or title. This is the provider that verifies a MONOGRAPH — the
 * reference kind the DOI-and-journal providers above will never find, and which
 * would otherwise be wrongly marked NOT_FOUND.
 *
 * Uses the Search API (`search.json`) rather than the edition endpoint because
 * it returns author names inline, avoiding a second author-key lookup.
 *
 * PRIVACY: only the ISBN or title string is sent — public data. Never the thesis
 * text, never the student's identity.
 */

const API = "https://openlibrary.org/search.json";
const FIELDS = "title,author_name,first_publish_year,isbn";

const docSchema = z.object({
  title: z.string().nullable().optional(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().nullable().optional(),
  isbn: z.array(z.string()).optional(),
});
type Doc = z.infer<typeof docSchema>;

const searchSchema = z.object({ docs: z.array(docSchema).optional() });

function toRecord(doc: Doc): ProviderRecord {
  return normaliseRecord(
    {
      found: true,
      title: doc.title ?? null,
      authors: doc.author_name ?? [],
      year: doc.first_publish_year ? String(doc.first_publish_year) : null,
      doi: null,
      url: doc.isbn?.[0] ? `https://openlibrary.org/isbn/${doc.isbn[0]}` : null,
      source: "open_library",
    },
    "open_library",
  );
}

function cleanIsbn(raw: string): string | null {
  const digits = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  return digits.length === 10 || digits.length === 13 ? digits : null;
}

export const openLibrary: ReferenceProvider = {
  name: "open_library",

  async byIsbn(rawIsbn: string, ctx: ProviderContext): Promise<ProviderRecord> {
    const isbn = cleanIsbn(rawIsbn);
    if (!isbn) return notFound("open_library");

    return withCache(ctx, "open_library", "isbn", isbn, async () => {
      // PRIVACY: only the ISBN leaves the app here.
      const url = `${API}?isbn=${encodeURIComponent(isbn)}&limit=1&fields=${FIELDS}`;
      const response = await politeFetch(url, {
        accept: "application/json",
        mailto: ctx.mailto,
        logProvider: "open_library",
        logTarget: isbn,
      }).catch(() => null);

      if (!response || !response.ok) return notFound("open_library");
      const parsed = searchSchema.safeParse(safeJson(response.text));
      const first = parsed.success ? parsed.data.docs?.[0] : undefined;
      return first ? toRecord(first) : notFound("open_library");
    });
  },

  async byQuery(query: string, ctx: ProviderContext): Promise<ProviderRecord> {
    const trimmed = query.trim();
    if (trimmed.length < 6) return notFound("open_library");

    return withCache(ctx, "open_library", "query", trimmed, async () => {
      // PRIVACY: only the reference's bibliographic string is sent — public data.
      const url = `${API}?q=${encodeURIComponent(trimmed)}&limit=3&fields=${FIELDS}`;
      const response = await politeFetch(url, {
        accept: "application/json",
        mailto: ctx.mailto,
        logProvider: "open_library",
        logTarget: trimmed,
      }).catch(() => null);

      if (!response || !response.ok) return notFound("open_library");
      const parsed = searchSchema.safeParse(safeJson(response.text));
      const first = parsed.success ? parsed.data.docs?.[0] : undefined;
      return first ? toRecord(first) : notFound("open_library");
    });
  },
};
