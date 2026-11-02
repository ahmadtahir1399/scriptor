import "server-only";

import type { AnalysisJob } from "@/lib/domain/job";
import type { JobContext } from "@/lib/jobs/registry";
import {
  getAnalysis,
  listCheckResults,
  listFindingsForAnalysis,
} from "@/lib/db/queries/analyses";
import { listPages } from "@/lib/db/queries/papers";
import { buildScopedBody, selectPagesForScope } from "@/lib/checks/pageScope";
import {
  clearDefenseQuestions,
  insertDefenseGroup,
  insertDefenseQuestions,
  setDefenseStatus,
} from "@/lib/db/queries/defense";
import { generateDefenseQuestions } from "@/lib/defense/generate";
import {
  difficultyToSeverity,
  encodeReferenceAnswer,
} from "@/lib/defense/practice";
import { DEFENSE_LIMITS } from "@/lib/defense/config";
import { CHECK_TASK_SCORE_CEILING } from "@/lib/todos/config";

/**
 * DEFENSE_QUESTIONS handler — an independent, optional sub-job.
 *
 * Reads the thesis (abstract + body, capped) and the analysis's weaknesses, then
 * generates grouped viva questions with model answers and key points. IDEMPOTENT:
 * clears prior questions first, so a regenerate replaces rather than duplicates.
 * FAILURE-ISOLATED: an error marks defense_status ERROR (the UI offers retry) and
 * never fails the parent analysis.
 */
export async function defenseQuestionsHandler(
  job: AnalysisJob,
  ctx: JobContext,
): Promise<void> {
  const analysisId = job.paper_analysis_id;
  const uploadId = job.paper_upload_id;

  try {
    const analysis = await getAnalysis(ctx.db, analysisId);
    if (!analysis)
      throw new Error(`DEFENSE_QUESTIONS: analysis ${analysisId} not found`);

    const pages = await listPages(ctx.db, uploadId);
    const scoped = selectPagesForScope(pages, ["ABSTRACT", "BODY"]).slice(
      0,
      DEFENSE_LIMITS.maxBodyPages,
    );
    const thesisBody = buildScopedBody(scoped);

    const findingsSummary = await buildWeaknessSummary(ctx.db, analysisId);

    await clearDefenseQuestions(ctx.db, analysisId);

    const groups = await generateDefenseQuestions({
      thesisBody,
      findingsSummary,
      attribution: {
        paperUploadId: uploadId,
        paperAnalysisId: analysisId,
        analysisJobId: job.id,
        userId: job.user_id,
        operation: "DEFENSE_QUESTIONS",
      },
    });

    let order = 0;
    for (const group of groups) {
      if (group.questions.length === 0) continue;

      const inserted = await insertDefenseGroup(ctx.db, {
        analysisId,
        paperId: analysis.paper_id,
        title: group.title,
        description: group.description,
        sortOrder: order,
      });

      await insertDefenseQuestions(
        ctx.db,
        inserted.id,
        group.questions
          .slice(0, DEFENSE_LIMITS.maxQuestionsPerGroup)
          .map((question, index) => ({
            question: question.question,
            referenceAnswer: encodeReferenceAnswer({
              explanation: question.explanation,
              answer: question.answer,
              keyPoints: question.key_points,
            }),
            sourceQuote: question.source_quote,
            pageNumber: null,
            difficulty: difficultyToSeverity(question.difficulty),
            sortOrder: index,
          })),
      );

      order += 1;
    }

    await setDefenseStatus(ctx.db, analysisId, "DONE");
  } catch (error) {
    console.error(
      `[defenseQuestions] generation failed for ${analysisId}`,
      error,
    );
    await setDefenseStatus(ctx.db, analysisId, "ERROR");
  }
}

/** Summarises the analysis's weaknesses as plain text for the generation prompt. */
async function buildWeaknessSummary(
  db: JobContext["db"],
  analysisId: string,
): Promise<string> {
  const lines: string[] = [];

  const checks = await listCheckResults(db, analysisId);
  for (const result of checks) {
    if (
      result.status !== "DONE" ||
      result.score === null ||
      result.score >= CHECK_TASK_SCORE_CEILING
    )
      continue;
    lines.push(
      `- (scored ${Math.round(result.score)}/100) ${truncate(result.feedback ?? "")}`,
    );
  }

  const findings = await listFindingsForAnalysis(db, analysisId);
  for (const finding of findings) {
    if (finding.is_resolved || finding.severity === "LOW") continue;
    lines.push(`- ${truncate(`${finding.title}: ${finding.quote}`)}`);
  }

  return lines.slice(0, 40).join("\n");
}

function truncate(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
