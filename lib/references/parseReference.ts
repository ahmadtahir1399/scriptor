import "server-only";

import { completeStructured } from "@/lib/ai/complete";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import { REFERENCE_LIMITS } from "@/lib/references/config";
import {
  bibliographyParseResponseSchema,
  type ParsedBibliographyEntry,
} from "@/lib/validations/reference";

/**
 * Parses ONE reference-list block into structured fields with the model.
 *
 * This is the ONLY use of the LLM in the whole Reference Health feature. Its
 * job is narrow: turn a messy citation string into `{ authors, year, title,
 * doi, ... }`. Everything downstream — reconciliation, verification — is
 * deterministic.
 *
 * SECURITY: the prompt receives ONE reference line and nothing else. The thesis
 * body never enters this prompt, and the student's identity never leaves the
 * app. The reference string is already public bibliographic data.
 */

const SYSTEM = `You parse a single academic reference-list entry into structured fields.

You are given ONE reference string, copied verbatim from a thesis bibliography. Return its bibliographic fields as JSON. Do not invent, correct, or complete anything the string does not contain — a missing DOI stays null, a missing year stays null. Never fabricate an identifier.

Return a JSON object of exactly this shape:
{
  "entry": {
    "authors": string[],        // surnames or full names, in order; [] if none
    "year": string | null,      // e.g. "2017", "2019a", "n.d." → null
    "title": string | null,     // the work's title, no surrounding quotes
    "container": string | null, // journal, book, or proceedings the work is in
    "publisher": string | null,
    "volume": string | null,
    "issue": string | null,
    "pages": string | null,
    "doi": string | null,       // bare "10.xxxx/yyyy", no URL prefix
    "url": string | null,
    "isbn": string | null,
    "type": "article" | "book" | "chapter" | "standard" | "grey" | "web"
  }
}

Pick "type" from the shape: a journal name → article; a publisher + no journal → book; "In: <book>" → chapter; an ISO/DIN/ASTM number → standard; a working paper / report / thesis → grey; a bare website → web. Return JSON only.`;

export async function parseReferenceBlock(args: {
  rawText: string;
  attribution: UsageAttribution;
}): Promise<ParsedBibliographyEntry> {
  // SECURITY: only the single reference string is sent — never the thesis body.
  const reference = args.rawText.slice(0, REFERENCE_LIMITS.maxRawEntryChars);

  const result = await completeStructured({
    role: "EXTRACTION",
    system: SYSTEM,
    user: reference,
    schema: bibliographyParseResponseSchema,
    schemaName: "bibliographyParse",
    attribution: args.attribution,
    temperature: 0,
    maxOutputTokens: 700,
  });

  return result.data.entry;
}
