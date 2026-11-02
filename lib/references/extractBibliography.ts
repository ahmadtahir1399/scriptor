import "server-only";

import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import { PARSE_CONCURRENCY } from "@/lib/references/config";
import { mapLimit } from "@/lib/references/providers/index";
import { parseReferenceBlock } from "@/lib/references/parseReference";
import { splitBibliographyBlocks } from "@/lib/references/splitEntries";
import {
  parsedBibliographyEntrySchema,
  type ParsedBibliographyEntry,
} from "@/lib/validations/reference";

/**
 * Stage 1 — turn the reference section into structured bibliography entries.
 *
 * Cutting the text into candidate entries is `splitEntries.ts`, which is pure
 * and tested. Here each block is handed to the model ONE AT A TIME to parse —
 * the thesis body never enters that prompt. The RAW string is preserved
 * verbatim, because the raw text is what the student recognises and what
 * verification re-parses if a field is missing.
 */

export interface ExtractedBibEntry {
  rawText: string;
  pageNumber: number | null;
  entryIndex: number;
  parsed: ParsedBibliographyEntry;
}

/**
 * Parses every block with the model, bounded by `PARSE_CONCURRENCY`.
 *
 * A block whose parse fails is NOT dropped — its raw text is kept with empty
 * structured fields, so the student still sees the reference (and it can still
 * be verified from the raw string). One bad entry never loses the rest.
 */
export async function extractBibliography(args: {
  pages: readonly { page_number: number; page_content: string }[];
  attribution: UsageAttribution;
}): Promise<ExtractedBibEntry[]> {
  const blocks = splitBibliographyBlocks(args.pages);

  const parsed = await mapLimit(blocks, PARSE_CONCURRENCY, async (block) => {
    try {
      return await parseReferenceBlock({
        rawText: block.rawText,
        attribution: args.attribution,
      });
    } catch (error) {
      console.warn("[references] failed to parse a bibliography entry", error);
      // Keep the raw entry with empty fields rather than losing it entirely.
      return parsedBibliographyEntrySchema.parse({});
    }
  });

  return blocks.map((block, index) => ({
    rawText: block.rawText,
    pageNumber: block.pageNumber,
    entryIndex: index,
    parsed: parsed[index] as ParsedBibliographyEntry,
  }));
}
