import "server-only";

import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import { writeFeedback } from "@/lib/ai/structured";
import {
  resolveQuoteToWordRange,
  dedupeOverlapping,
} from "@/lib/checks/resolveFindings";
import { computeAnalysisScore, type CheckRating } from "@/lib/analysis/scoring";
import { OUTPUT_LIMITS } from "@/lib/analysis/config";
import { SEVERITY_RANK } from "@/lib/validations/analysis";
import { getCheckVersion, getChecksByIds } from "@/lib/db/queries/checks";
import { listWordsForPage } from "@/lib/db/queries/papers";
import {
  completeCheckResult,
  deleteFindingById,
  listCheckResults,
  listFindingsForAnalysis,
  setAnalysisScore,
  updateCheckResultStructured,
} from "@/lib/db/queries/analyses";
import type { Db } from "@/lib/db/queries/papers";
import type { Finding } from "@/lib/domain/analysis";

/**
 * Post-processing — the barrier's terminal step.
 *
 * Runs once, after every check job is terminal. It:
 *   1. finalises INDIVIDUAL_PAGES results (turns accumulated findings into
 *      feedback + a score),
 *   2. resolves rated-check finding quotes to word ranges where a page is known,
 *   3. dedupes grammar findings that overlap the same words across checks,
 *   4. computes the overall score and completes the analysis.
 *
 * No new call path: every model call still routes through the AI layer and
 * logs token_usage.
 */
export async function postProcessAnalysis(
  db: Db,
  args: { analysisId: string; uploadId: string; userId: string },
): Promise<void> {
  const results = await listCheckResults(db, args.analysisId);

  // Map check id → code, for scoring weights and category rollup.
  const checkIds = [...new Set(results.map((result) => result.check_id))];
  const checks = await getChecksByIds(db, checkIds);
  const codeById = new Map(checks.map((check) => [check.id, check.code]));

  // 1. Finalise any INDIVIDUAL_PAGES results still awaiting feedback.
  const allFindings = await listFindingsForAnalysis(db, args.analysisId);
  await finaliseIndividualResults(db, args, results, allFindings, codeById);

  // 2. Resolve rated-check findings (stored in feedback_structured) to word
  //    ranges where the model reported a page. Best-effort — a finding with no
  //    page is left unresolved rather than resolved wrongly.
  await resolveRatedFindings(db, args.uploadId, results);

  // 3. Dedupe grammar findings across checks by overlapping word range.
  await dedupeGrammarFindings(db, allFindings);

  // 4. Score. Re-read results so freshly-finalised INDIVIDUAL_PAGES scores count.
  const scoredResults = await listCheckResults(db, args.analysisId);
  const ratings: CheckRating[] = scoredResults.map((result) => ({
    checkCode: codeById.get(result.check_id) ?? "UNKNOWN",
    score: result.score,
    errored: result.status === "ERROR",
  }));

  const { overall } = computeAnalysisScore(ratings);
  await setAnalysisScore(db, args.analysisId, overall);
}

/**
 * Turns each INDIVIDUAL_PAGES check's accumulated findings into one feedback +
 * score, then marks its result DONE.
 *
 * These results are still GENERATING at this point — the grammar jobs wrote
 * findings but no prose. A result with no findings gets a clean "no issues"
 * feedback and a high score rather than an empty card.
 */
async function finaliseIndividualResults(
  db: Db,
  args: { analysisId: string; uploadId: string; userId: string },
  results: readonly {
    id: string;
    check_id: string;
    check_version_id: string;
    status: string;
  }[],
  allFindings: readonly Finding[],
  codeById: ReadonlyMap<string, string>,
): Promise<void> {
  const pending = results.filter((result) => result.status === "GENERATING");

  for (const result of pending) {
    const version = await getCheckVersion(db, result.check_version_id);
    if (!version) continue;

    const findings = allFindings.filter(
      (finding) => finding.check_result_id === result.id,
    );

    const attribution: UsageAttribution = {
      paperUploadId: args.uploadId,
      paperAnalysisId: args.analysisId,
      analysisJobId: null,
      userId: args.userId,
      operation: "GRAMMAR",
    };

    let feedback: string;
    let score: number;

    if (findings.length === 0) {
      // Nothing found is a good outcome, not an empty one.
      feedback = "No issues were found for this check.";
      score = 95;
    } else {
      const summary = JSON.stringify(
        {
          findings: findings
            .slice(0, OUTPUT_LIMITS.maxFindingsPerCheck)
            .map((finding) => ({
              quote: finding.quote,
              correction: finding.correction,
              type: finding.type,
              severity: finding.severity,
              page: finding.page_number,
            })),
        },
        null,
        2,
      );

      const feedbackResult = await writeFeedback({
        role: version.model,
        feedbackPrompt: `${version.feedback_prompt}

Return a JSON object with exactly two fields:
  "feedback": the student-facing explanation in Markdown,
  "score": an integer 0–100 (100 = flawless).
Return JSON only.`,
        structuredFindings: summary,
        attribution,
        maxOutputTokens: OUTPUT_LIMITS.feedbackMaxTokens,
      });

      const parsed = parseFeedbackJson(feedbackResult.text, findings.length);
      feedback = parsed.feedback;
      score = parsed.score;
    }

    void codeById; // code is used for scoring later, not needed for the write.

    await completeCheckResult(db, result.id, {
      feedback,
      feedbackStructured: { findingCount: findings.length },
      score,
    });
  }
}

/**
 * Resolves rated-check findings to word ranges.
 *
 * Rated findings live in `feedback_structured.findings`; each may carry a
 * page_number. Where it does, we match the quote against that page's words and
 * write the range back into the JSON, so P7 can highlight it. Words are fetched
 * per page and cached, so a check with ten findings on three pages does three
 * word reads, not ten.
 */
async function resolveRatedFindings(
  db: Db,
  uploadId: string,
  results: readonly { id: string; feedback_structured: unknown }[],
): Promise<void> {
  const wordsByPage = new Map<number, { text: string; wordIndex: number }[]>();

  for (const result of results) {
    const structured = result.feedback_structured;
    if (!isFindingsPayload(structured)) continue;

    let changed = false;

    for (const finding of structured.findings) {
      if (typeof finding.page_number !== "number") continue;
      if (typeof finding.quote !== "string") continue;

      let words = wordsByPage.get(finding.page_number);
      if (!words) {
        const rows = await listWordsForPage(db, uploadId, finding.page_number);
        words = rows.map((row) => ({
          text: row.text,
          wordIndex: row.word_index,
        }));
        wordsByPage.set(finding.page_number, words);
      }

      const range = resolveQuoteToWordRange(finding.quote, words);
      if (range) {
        finding.word_index_start = range.wordIndexStart;
        finding.word_index_end = range.wordIndexEnd;
        changed = true;
      }
    }

    if (changed) {
      await updateCheckResultStructured(db, result.id, structured);
    }
  }
}

/** Dedupes grammar findings by overlapping word range, keeping the most severe. */
async function dedupeGrammarFindings(
  db: Db,
  allFindings: readonly Finding[],
): Promise<void> {
  const locatable = allFindings.filter(
    (finding) =>
      finding.word_index_start !== null && finding.word_index_end !== null,
  );

  const items = locatable.map((finding) => ({
    id: finding.id,
    wordIndexStart: finding.word_index_start as number,
    wordIndexEnd: finding.word_index_end as number,
    severityRank: SEVERITY_RANK[finding.severity] ?? 2,
  }));

  const kept = new Set(dedupeOverlapping(items).map((item) => item.id));

  for (const finding of locatable) {
    if (!kept.has(finding.id)) {
      await deleteFindingById(db, finding.id);
    }
  }
}

// --- helpers --------------------------------------------------------------

interface FindingsPayload {
  findings: Array<{
    quote?: unknown;
    page_number?: unknown;
    word_index_start?: number;
    word_index_end?: number;
  }>;
}

function isFindingsPayload(value: unknown): value is FindingsPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "findings" in value &&
    Array.isArray((value as { findings: unknown }).findings)
  );
}

function parseFeedbackJson(
  raw: string,
  findingCount: number,
): { feedback: string; score: number } {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
        feedback?: unknown;
        score?: unknown;
      };
      if (
        typeof parsed.feedback === "string" &&
        typeof parsed.score === "number"
      ) {
        return {
          feedback: parsed.feedback,
          score: Math.min(100, Math.max(0, Math.round(parsed.score))),
        };
      }
    } catch {
      // fall through
    }
  }
  return { feedback: trimmed, score: Math.max(40, 95 - findingCount * 5) };
}
