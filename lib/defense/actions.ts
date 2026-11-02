"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnalysis } from "@/lib/db/queries/analyses";
import {
  createPractice as createPracticeRow,
  getDefenseQuestionCount,
  getDefenseQuestion,
  getDefenseQuestions,
  getPractice,
  getPracticeWithAnswers,
  insertAnswer,
  listPractices,
  requeueDefenseJob,
  setDefenseStatus,
  updatePracticeProgress,
  type DefenseAnswer,
  type DefenseGroupWithQuestions,
  type DefensePractice,
} from "@/lib/db/queries/defense";
import { kickWorker } from "@/lib/jobs/kick";
import { generateAnswerFeedback } from "@/lib/defense/feedback";
import {
  encodeFeedback,
  parseReferenceAnswer,
  verdictToScore,
} from "@/lib/defense/practice";
import type { JobStatus } from "@/lib/db/enums";
import type { AnswerFeedbackData } from "@/lib/validations/defense";
import {
  createPracticeSchema,
  finishPracticeSchema,
  generateDefenseSchema,
  skipAnswerSchema,
  submitAnswerSchema,
} from "@/lib/validations/defense";

/**
 * Defense-prep server actions.
 *
 * Questions and groups are read RLS-scoped; practices are user-writable.
 * Ownership of the parent analysis / practice is re-verified before every write.
 * Answer feedback is model output, so it is generated and written under the
 * service role. The feedback prompt never receives the thesis — only the
 * question, its key points, and the student's answer.
 */

export type DefenseActionResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface DefenseData {
  status: JobStatus;
  groups: DefenseGroupWithQuestions[];
  practices: DefensePractice[];
}

export async function getDefenseData(
  analysisId: string,
): Promise<DefenseData | null> {
  const user = await requireSessionUser();
  const db = await createClient();

  const analysis = await getAnalysis(db, analysisId);
  if (!analysis || analysis.user_id !== user.id) return null;

  const [groups, practices] = await Promise.all([
    getDefenseQuestions(db, analysisId),
    listPractices(db, analysisId),
  ]);

  return { status: analysis.defense_status, groups, practices };
}

export interface PracticeData {
  analysisId: string;
  practice: DefensePractice;
  groups: DefenseGroupWithQuestions[];
  answers: DefenseAnswer[];
}

export async function getPracticeData(
  practiceId: string,
): Promise<PracticeData | null> {
  const user = await requireSessionUser();
  const db = await createClient();

  const practice = await getPracticeWithAnswers(db, practiceId);
  if (!practice || practice.user_id !== user.id) return null;

  const groups = await getDefenseQuestions(db, practice.paper_analysis_id);

  return {
    analysisId: practice.paper_analysis_id,
    practice,
    groups,
    answers: practice.answers,
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export async function generateDefense(
  input: unknown,
): Promise<DefenseActionResult> {
  const parsed = generateDefenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await setDefenseStatus(admin, parsed.data.analysisId, "GENERATING");
    await requeueDefenseJob(
      admin,
      parsed.data.analysisId,
      analysis.paper_upload_id,
    );
    kickWorker();

    revalidatePath(`/analysis/${parsed.data.analysisId}/defense`);
    return { ok: true };
  } catch (error) {
    console.error("[defense] generateDefense failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

export async function createPractice(
  input: unknown,
): Promise<{ ok: true; practiceId: string } | { ok: false; error: string }> {
  const parsed = createPracticeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const questionCount = await getDefenseQuestionCount(
      db,
      parsed.data.analysisId,
    );
    if (questionCount === 0) return { ok: false, error: "no_questions" };

    const practice = await createPracticeRow(db, {
      analysisId: parsed.data.analysisId,
      questionCount,
    });
    return { ok: true, practiceId: practice.id };
  } catch (error) {
    console.error("[defense] createPractice failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function submitAnswer(
  input: unknown,
): Promise<
  { ok: true; feedback: AnswerFeedbackData } | { ok: false; error: string }
> {
  const parsed = submitAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const practice = await getPractice(db, parsed.data.practiceId);
    if (!practice || practice.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const question = await getDefenseQuestion(db, parsed.data.questionId);
    if (!question) return { ok: false, error: "not_found" };

    const reference = parseReferenceAnswer(question.reference_answer);

    // The feedback prompt receives only the question, its key points and the
    // student's answer — never the thesis.
    const feedback = await generateAnswerFeedback({
      question: question.question,
      keyPoints: reference.keyPoints,
      answer: parsed.data.answer,
      attribution: {
        paperUploadId: null,
        paperAnalysisId: practice.paper_analysis_id,
        analysisJobId: null,
        userId: user.id,
        operation: "DEFENSE_QUESTIONS",
      },
    });

    const admin = createAdminClient();
    await insertAnswer(admin, {
      practiceId: parsed.data.practiceId,
      questionId: parsed.data.questionId,
      answerText: parsed.data.answer,
      feedback: encodeFeedback(feedback),
      score: verdictToScore(feedback.verdict),
    });
    await refreshProgress(admin, parsed.data.practiceId);

    revalidatePath(
      `/analysis/${practice.paper_analysis_id}/defense/${parsed.data.practiceId}`,
    );
    return { ok: true, feedback };
  } catch (error) {
    console.error("[defense] submitAnswer failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function skipAnswer(input: unknown): Promise<DefenseActionResult> {
  const parsed = skipAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const practice = await getPractice(db, parsed.data.practiceId);
    if (!practice || practice.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await insertAnswer(admin, {
      practiceId: parsed.data.practiceId,
      questionId: parsed.data.questionId,
      answerText: "",
      feedback: null,
      score: null,
    });
    await refreshProgress(admin, parsed.data.practiceId);

    return { ok: true };
  } catch (error) {
    console.error("[defense] skipAnswer failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function finishPractice(
  input: unknown,
): Promise<DefenseActionResult> {
  const parsed = finishPracticeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const practice = await getPractice(db, parsed.data.practiceId);
    if (!practice || practice.user_id !== user.id)
      return { ok: false, error: "not_found" };

    await refreshProgress(createAdminClient(), parsed.data.practiceId, true);
    revalidatePath(`/analysis/${practice.paper_analysis_id}/defense`);
    return { ok: true };
  } catch (error) {
    console.error("[defense] finishPractice failed", error);
    return { ok: false, error: "unknown" };
  }
}

/** Recomputes a practice's answered count and average score from its answers. */
async function refreshProgress(
  admin: ReturnType<typeof createAdminClient>,
  practiceId: string,
  forceComplete = false,
): Promise<void> {
  const practice = await getPracticeWithAnswers(admin, practiceId);
  if (!practice) return;

  const answeredCount = practice.answers.length;
  const scored = practice.answers
    .map((answer) => answer.score)
    .filter((score): score is number => score !== null);
  const averageScore =
    scored.length > 0
      ? Number(
          (
            scored.reduce((sum, score) => sum + score, 0) / scored.length
          ).toFixed(2),
        )
      : null;
  const completed = forceComplete || answeredCount >= practice.question_count;

  await updatePracticeProgress(admin, practiceId, {
    answeredCount,
    averageScore,
    completed,
  });
}
