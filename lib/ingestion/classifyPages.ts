import "server-only";

import { z } from "zod";

import { PAGE_TYPES, type PageType } from "@/lib/db/enums";
import { completeStructured } from "@/lib/ai/complete";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import {
  classifyByHeuristics,
  type HeuristicInput,
} from "@/lib/ingestion/pageHeuristics";

/**
 * Page classification — rules first, model only for genuine ambiguity.
 *
 * Batched 20 pages per call with a 400-character excerpt each. One call per
 * page would mean ~200 calls for a thesis, which is both slow and needlessly
 * expensive for a task the rules already resolve most of.
 */

const BATCH_SIZE = 20;
const EXCERPT_CHARS = 400;

/** Enum members come from `lib/db/enums.ts` — never retyped as a union. */
const classificationSchema = z.object({
  pages: z.array(
    z.object({
      page_number: z.number().int().positive(),
      page_type: z.enum(PAGE_TYPES),
    }),
  ),
});

const SYSTEM_PROMPT = `You classify pages of an academic thesis by their structural role.

You will receive a numbered list of page excerpts. For EACH page, return exactly one page_type from this list:

COVER                  title page
ABSTRACT               abstract / Zusammenfassung / Kurzfassung
TOC                    table of contents / Inhaltsverzeichnis
LIST_OF_ABBREVIATIONS  abbreviations / Abkürzungsverzeichnis
BODY                   the actual argument — chapters, analysis, discussion
BIBLIOGRAPHY           reference list / Literaturverzeichnis
APPENDIX               appendix / Anhang
OTHER                  blank, declaration of authorship, acknowledgements

Rules:
- Judge the page's role in the document, not its subject matter.
- A page of prose that argues, explains or analyses is BODY.
- A page that is mostly citation entries is BIBLIOGRAPHY, even without a heading.
- A declaration of originality or acknowledgements page is OTHER, not BODY.
- Documents may be in German or English; both use the same page_type values.
- Return one entry per page you were given. Do not omit any, do not invent extras.

Return JSON only: { "pages": [ { "page_number": 7, "page_type": "BODY" } ] }`;

export interface ClassifyPagesInput {
  pages: HeuristicInput[];
  attribution: UsageAttribution;
}

export interface ClassifiedPage {
  pageNumber: number;
  pageType: PageType;
}

/**
 * Classifies every page.
 *
 * A failed model batch does NOT fail ingestion: the heuristic guess for those
 * pages stands instead. Losing some classification precision degrades check
 * scoping slightly; failing the whole upload over it would lose the student
 * their entire analysis.
 */
export async function classifyPages(
  input: ClassifyPagesInput,
): Promise<ClassifiedPage[]> {
  const heuristics = classifyByHeuristics(input.pages);

  const byPage = new Map<number, PageType>(
    heuristics.map((result) => [result.pageNumber, result.pageType]),
  );

  const ambiguous = heuristics.filter((result) => !result.confident);
  if (ambiguous.length === 0) {
    return toSortedResult(byPage);
  }

  const textByPage = new Map(
    input.pages.map((page) => [page.pageNumber, page.text]),
  );

  for (let offset = 0; offset < ambiguous.length; offset += BATCH_SIZE) {
    const batch = ambiguous.slice(offset, offset + BATCH_SIZE);

    const excerpts = batch
      .map((item) => {
        const text = (textByPage.get(item.pageNumber) ?? "")
          .slice(0, EXCERPT_CHARS)
          .replace(/\s+/g, " ")
          .trim();
        return `--- PAGE ${item.pageNumber} ---\n${text}`;
      })
      .join("\n\n");

    try {
      const { data } = await completeStructured({
        role: "FAST",
        schema: classificationSchema,
        schemaName: "classifyPages",
        system: SYSTEM_PROMPT,
        user: excerpts,
        attribution: { ...input.attribution, operation: "IDENTIFY_PAGES" },
        temperature: 0,
      });

      for (const page of data.pages) {
        // Only accept answers for pages we actually asked about — a model that
        // hallucinates page 999 must not add a row.
        if (byPage.has(page.page_number)) {
          byPage.set(page.page_number, page.page_type);
        }
      }
    } catch (error) {
      console.error(
        "[classifyPages] batch failed, keeping heuristic result for these pages",
        { pages: batch.map((item) => item.pageNumber), error },
      );
    }
  }

  return toSortedResult(byPage);
}

function toSortedResult(
  byPage: ReadonlyMap<number, PageType>,
): ClassifiedPage[] {
  return [...byPage.entries()]
    .map(([pageNumber, pageType]) => ({ pageNumber, pageType }))
    .sort((a, b) => a.pageNumber - b.pageNumber);
}
