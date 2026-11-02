import "server-only";

import type { CheckVersion } from "@/lib/domain/check";
import type { PaperPage, Word } from "@/lib/domain/paper";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import { analyseWithCache } from "@/lib/ai/structured";
import { resolveQuoteToWordRange } from "@/lib/checks/resolveFindings";
import { OUTPUT_LIMITS } from "@/lib/analysis/config";
import type { FindingInsert } from "@/lib/db/queries/analyses";
import { grammarResponseSchema } from "@/lib/validations/analysis";

/**
 * Runs an INDIVIDUAL_PAGES check against ONE page.
 *
 * Grammar-type findings carry a concrete correction and a grammar-scoped type,
 * so each maps directly onto a `findings` table row. The quote is resolved to a
 * word range HERE, against this page's own words — we have them in hand, and
 * resolving now means the findings row is fully located by the time
 * post-processing runs.
 *
 * A finding whose quote cannot be located on the page is DROPPED, never guessed
 * — an unanchorable highlight is worse than a missing one.
 */

export interface RunGrammarOutcome {
  findings: FindingInsert[];
  cachedInputTokens: number;
  /** Findings the model returned but we could not locate — dropped, counted. */
  droppedUnlocatable: number;
}

export async function runGrammarPage(args: {
  version: CheckVersion;
  role: string;
  page: PaperPage;
  words: readonly Word[];
  attribution: UsageAttribution;
}): Promise<RunGrammarOutcome> {
  // Per-page body. Reuses the same page marker format as the ALL_PAGES builder,
  // so a per-page prompt reads consistently with the whole-document ones.
  const body = `[[page:${args.page.page_number}]]\n${args.page.page_content}`;

  const analysis = await analyseWithCache({
    role: args.role,
    documentBody: body,
    analysisInstruction: args.version.analysis_prompt,
    schema: grammarResponseSchema,
    schemaName: "grammar",
    attribution: args.attribution,
    temperature: args.version.temperature,
    maxOutputTokens: OUTPUT_LIMITS.analysisMaxTokens,
  });

  const wordRefs = args.words.map((word) => ({
    text: word.text,
    wordIndex: word.word_index,
  }));

  const findings: FindingInsert[] = [];
  let dropped = 0;

  for (const finding of analysis.data.findings.slice(
    0,
    OUTPUT_LIMITS.maxFindingsPerCheck,
  )) {
    const range = resolveQuoteToWordRange(finding.quote, wordRefs);
    if (!range) {
      dropped += 1;
      continue;
    }

    findings.push({
      quote: finding.quote,
      correction: finding.correction,
      // Prefer what the model actually wrote; the type and the correction are
      // only a fallback for a response that omitted the prose.
      title: finding.title?.trim() || finding.type,
      description:
        finding.description?.trim() ||
        (finding.correction
          ? `Suggested correction: ${finding.correction}`
          : ""),
      pageNumber: args.page.page_number,
      wordIndexStart: range.wordIndexStart,
      wordIndexEnd: range.wordIndexEnd,
      type: finding.type,
      severity: finding.severity,
    });
  }

  return {
    findings,
    cachedInputTokens: analysis.cachedInputTokens,
    droppedUnlocatable: dropped,
  };
}
