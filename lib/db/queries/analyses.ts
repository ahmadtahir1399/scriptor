import type { Database, TablesInsert } from "@/lib/db/types.generated";
import type { FindingSeverity, FindingType, JobStatus } from "@/lib/db/enums";
import type {
  AnalysisWithResults,
  CheckResult,
  Finding,
  PaperAnalysis,
} from "@/lib/domain/analysis";
import type { Db } from "@/lib/db/queries/papers";

/** Analysis aggregate reads. P6's report page is built on these. */

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Check results join `checks_public`, never `checks` or `check_versions`.
 *
 * That is not a preference: `check_versions` holds the prompt IP and carries no
 * SELECT grant for ordinary users, so a join to it would fail for exactly the
 * people this query serves.
 */
const CHECK_RESULT_SELECT = `
  *,
  check:checks_public!check_results_check_id_fkey(
    id, code, name_en, name_de, description_en, description_de,
    processing_mode, page_scope, is_active, sort_order,
    active_version_id, active_version, active_version_locale
  ),
  findings(*)
`;

export async function getAnalysis(
  db: Db,
  analysisId: string,
): Promise<PaperAnalysis | null> {
  const result = await db
    .from("paper_analyses")
    .select("*")
    .eq("id", analysisId)
    .maybeSingle();

  return unwrap(result, "getAnalysis");
}

/** The whole report in one round trip. */
export async function getAnalysisWithResults(
  db: Db,
  analysisId: string,
): Promise<AnalysisWithResults | null> {
  const result = await db
    .from("paper_analyses")
    .select(`*, check_results(${CHECK_RESULT_SELECT})`)
    .eq("id", analysisId)
    .maybeSingle();

  return unwrap(
    result,
    "getAnalysisWithResults",
  ) as unknown as AnalysisWithResults | null;
}

/**
 * Header data for the report shell — paper title, document type, filename, and
 * when it was analysed.
 *
 * Scoped by RLS: a request for another user's analysis returns null (rendered
 * as not-found), never a permission error that would confirm the id exists.
 * Selects only client-safe columns; it never touches check_versions or any
 * prompt text.
 */
export interface AnalysisReportHeader {
  id: string;
  status: PaperAnalysis["status"];
  createdAt: string;
  completedAt: string | null;
  paperId: string;
  paperTitle: string;
  documentTypeCode: string | null;
  fileName: string | null;
}

export async function getAnalysisReportHeader(
  db: Db,
  analysisId: string,
): Promise<AnalysisReportHeader | null> {
  const result = await db
    .from("paper_analyses")
    .select(
      "id, status, created_at, completed_at, paper_id, " +
        "paper:papers!paper_analyses_paper_id_fkey(title), " +
        "upload:paper_uploads!paper_analyses_paper_upload_id_fkey(file_name, document_type_code)",
    )
    .eq("id", analysisId)
    .maybeSingle();

  const row = unwrap(result, "getAnalysisReportHeader") as unknown as {
    id: string;
    status: PaperAnalysis["status"];
    created_at: string;
    completed_at: string | null;
    paper_id: string;
    paper: { title: string } | null;
    upload: {
      file_name: string | null;
      document_type_code: string | null;
    } | null;
  } | null;

  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    paperId: row.paper_id,
    paperTitle: row.paper?.title ?? "",
    documentTypeCode: row.upload?.document_type_code ?? null,
    fileName: row.upload?.file_name ?? null,
  };
}

export async function getLatestAnalysisForUpload(
  db: Db,
  uploadId: string,
): Promise<PaperAnalysis | null> {
  const result = await db
    .from("paper_analyses")
    .select("*")
    .eq("paper_upload_id", uploadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return unwrap(result, "getLatestAnalysisForUpload");
}

export async function listAnalysesForPaper(
  db: Db,
  paperId: string,
): Promise<PaperAnalysis[]> {
  const result = await db
    .from("paper_analyses")
    .select("*")
    .eq("paper_id", paperId)
    .order("created_at", { ascending: false });

  return unwrap(result, "listAnalysesForPaper");
}

/**
 * Visible check results only.
 *
 * The RLS policy already filters A/B losers for ordinary users, but stating it
 * here keeps the intent readable and keeps the result correct for a
 * service-role caller, which bypasses RLS entirely.
 */
export async function listCheckResults(
  db: Db,
  analysisId: string,
): Promise<CheckResult[]> {
  const result = await db
    .from("check_results")
    .select("*")
    .eq("paper_analysis_id", analysisId)
    .eq("hidden_because_ab_test", false)
    .order("created_at", { ascending: true });

  return unwrap(result, "listCheckResults");
}

export async function getCheckResult(
  db: Db,
  checkResultId: string,
): Promise<CheckResult | null> {
  const result = await db
    .from("check_results")
    .select("*")
    .eq("id", checkResultId)
    .maybeSingle();

  return unwrap(result, "getCheckResult");
}

/**
 * Records the student's rating.
 *
 * Only the three columns granted in 15_rls.sql are written. Adding any other
 * column here would be rejected by the column grant at runtime.
 */
export async function rateCheckResult(
  db: Db,
  input: {
    checkResultId: string;
    rating: number | null;
    isHelpful: boolean | null;
    userComment: string | null;
  },
): Promise<void> {
  const result = await db
    .from("check_results")
    .update({
      rating: input.rating,
      is_helpful: input.isHelpful,
      user_comment: input.userComment,
    })
    .eq("id", input.checkResultId);

  if (result.error) {
    throw new Error(`rateCheckResult: ${result.error.message}`);
  }
}

/**
 * Records helpfulness feedback on a check result.
 *
 * Writes only the three user-owned columns P1's column grant permits
 * (`is_helpful`, `user_comment`, `rating`); here only the first two. RLS scopes
 * the update to the caller's own rows, so a cross-user write simply matches
 * nothing. Runs on the user-session client, never the service role.
 */
export async function setCheckResultHelpfulness(
  db: Db,
  checkResultId: string,
  isHelpful: boolean | null,
  comment: string | null,
): Promise<void> {
  const result = await db
    .from("check_results")
    .update({ is_helpful: isHelpful, user_comment: comment })
    .eq("id", checkResultId);

  if (result.error) {
    throw new Error(`setCheckResultHelpfulness: ${result.error.message}`);
  }
}

/** Per-feature status, for rendering the optional-feature panels. */
export async function getAnalysisStatuses(
  db: Db,
  analysisId: string,
): Promise<Pick<
  Database["public"]["Tables"]["paper_analyses"]["Row"],
  | "status"
  | "plagiarism_status"
  | "todo_status"
  | "defense_status"
  | "reference_health_status"
  | "ai_detection_status"
> | null> {
  const result = await db
    .from("paper_analyses")
    .select(
      "status, plagiarism_status, todo_status, defense_status, reference_health_status, ai_detection_status",
    )
    .eq("id", analysisId)
    .maybeSingle();

  return unwrap(result, "getAnalysisStatuses");
}

// ===========================================================================
// P4 — engine writes. Service-role only (check_results, findings and the
// score/status columns of paper_analyses are not user-writable under P1's RLS).
// ===========================================================================

/**
 * Creates a check_results row in the GENERATING state.
 *
 * Written at fan-out time so the report page has a card to fill in live from
 * the very first render, rather than cards popping into existence as checks
 * start. `check_version_id` is immutable provenance — which prompt produced
 * this result.
 */
export async function createCheckResult(
  db: Db,
  args: {
    analysisId: string;
    checkId: string;
    checkVersionId: string;
    abTestId: string | null;
    hiddenBecauseAbTest: boolean;
  },
): Promise<CheckResult> {
  const result = await db
    .from("check_results")
    .insert({
      paper_analysis_id: args.analysisId,
      check_id: args.checkId,
      check_version_id: args.checkVersionId,
      status: "GENERATING",
      ab_test_id: args.abTestId,
      hidden_because_ab_test: args.hiddenBecauseAbTest,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  return unwrap(result, "createCheckResult");
}

/** Finds a check_result by (analysis, check) — the idempotent handle a retry uses. */
export async function findCheckResult(
  db: Db,
  analysisId: string,
  checkId: string,
): Promise<CheckResult | null> {
  const result = await db
    .from("check_results")
    .select("*")
    .eq("paper_analysis_id", analysisId)
    .eq("check_id", checkId)
    .maybeSingle();

  return unwrap(result, "findCheckResult");
}

/** Writes a completed result. `score` is the model's 0–100, never the user rating. */
export async function completeCheckResult(
  db: Db,
  checkResultId: string,
  args: {
    feedback: string;
    feedbackStructured: unknown;
    score: number | null;
  },
): Promise<void> {
  const result = await db
    .from("check_results")
    .update({
      status: "DONE",
      feedback: args.feedback,
      feedback_structured: args.feedbackStructured as never,
      score: args.score,
      completed_at: new Date().toISOString(),
    })
    .eq("id", checkResultId);

  if (result.error) {
    throw new Error(`completeCheckResult: ${result.error.message}`);
  }
}

/**
 * Flips one check_result back to the working state for a retry.
 *
 * Clears the prior feedback, score and error so the card shows a clean working
 * state rather than stale content behind a spinner.
 */
export async function resetCheckResultToWorking(
  db: Db,
  checkResultId: string,
): Promise<void> {
  const result = await db
    .from("check_results")
    .update({
      status: "GENERATING",
      feedback: null,
      feedback_structured: {} as never,
      score: null,
      error_message: null,
      completed_at: null,
    })
    .eq("id", checkResultId);

  if (result.error) {
    throw new Error(`resetCheckResultToWorking: ${result.error.message}`);
  }
}

/**
 * Re-queues the job(s) for one check within an analysis.
 *
 * Matches on the `checkId` carried in the job payload, so a RUN_CHECK job or
 * the whole set of GRAMMAR page-jobs for that check are reset together. Sets
 * status back to NONE and attempts to 0 so the worker claims them fresh; the
 * unique idempotency key means the rows are reused, never duplicated.
 */
export async function requeueCheckJobs(
  db: Db,
  analysisId: string,
  checkId: string,
): Promise<number> {
  const result = await db
    .from("analysis_jobs")
    .update({
      status: "NONE",
      attempts: 0,
      run_after: new Date().toISOString(),
      claimed_at: null,
      claimed_by: null,
      last_error: null,
      completed_at: null,
    })
    .eq("paper_analysis_id", analysisId)
    .filter("payload->>checkId", "eq", checkId)
    .select("id");

  if (result.error) {
    throw new Error(`requeueCheckJobs: ${result.error.message}`);
  }
  return result.data?.length ?? 0;
}

/** Overwrites only feedback_structured — used to write back resolved word ranges. */
export async function updateCheckResultStructured(
  db: Db,
  checkResultId: string,
  structured: unknown,
): Promise<void> {
  const result = await db
    .from("check_results")
    .update({ feedback_structured: structured as never })
    .eq("id", checkResultId);

  if (result.error) {
    throw new Error(`updateCheckResultStructured: ${result.error.message}`);
  }
}

/**
 * Marks a check_result errored.
 *
 * `message` is human detail only — NEVER the prompt text. A permanently failed
 * check becomes one error card and the analysis still completes with the other
 * eight results. This is the failure-isolation invariant.
 */
export async function failCheckResult(
  db: Db,
  checkResultId: string,
  message: string,
): Promise<void> {
  const result = await db
    .from("check_results")
    .update({
      status: "ERROR",
      error_message: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", checkResultId);

  if (result.error) {
    throw new Error(`failCheckResult: ${result.error.message}`);
  }
}

export interface FindingInsert {
  quote: string;
  correction: string | null;
  title: string;
  description: string;
  pageNumber: number | null;
  wordIndexStart: number | null;
  wordIndexEnd: number | null;
  type: FindingType;
  severity: FindingSeverity;
}

/** Clears a check_result's findings, so a retry replaces rather than duplicates. */
export async function clearFindingsForCheckResult(
  db: Db,
  checkResultId: string,
): Promise<void> {
  const result = await db
    .from("findings")
    .delete()
    .eq("check_result_id", checkResultId);
  if (result.error) {
    throw new Error(`clearFindingsForCheckResult: ${result.error.message}`);
  }
}

/**
 * Clears findings for one (check_result, page).
 *
 * Page-scoped so a retried GRAMMAR job replaces only its own page's findings
 * and never wipes the other pages a sibling job already wrote.
 */
export async function clearFindingsForPage(
  db: Db,
  checkResultId: string,
  pageNumber: number,
): Promise<void> {
  const result = await db
    .from("findings")
    .delete()
    .eq("check_result_id", checkResultId)
    .eq("page_number", pageNumber);

  if (result.error) {
    throw new Error(`clearFindingsForPage: ${result.error.message}`);
  }
}

/** Bulk-inserts findings for a check_result. */
export async function insertFindings(
  db: Db,
  args: {
    checkResultId: string;
    analysisId: string;
    findings: readonly FindingInsert[];
  },
): Promise<number> {
  if (args.findings.length === 0) return 0;

  const rows: TablesInsert<"findings">[] = args.findings.map((finding) => ({
    check_result_id: args.checkResultId,
    paper_analysis_id: args.analysisId,
    quote: finding.quote,
    correction: finding.correction,
    title: finding.title,
    description: finding.description,
    page_number: finding.pageNumber,
    word_index_start: finding.wordIndexStart,
    word_index_end: finding.wordIndexEnd,
    type: finding.type,
    severity: finding.severity,
  }));

  const result = await db.from("findings").insert(rows);
  if (result.error) {
    throw new Error(`insertFindings: ${result.error.message}`);
  }
  return rows.length;
}

/** All findings for an analysis — post-processing reads these to dedupe. */
export async function listFindingsForAnalysis(
  db: Db,
  analysisId: string,
): Promise<Finding[]> {
  const result = await db
    .from("findings")
    .select("*")
    .eq("paper_analysis_id", analysisId);

  return unwrap(result, "listFindingsForAnalysis");
}

export async function deleteFindingById(
  db: Db,
  findingId: string,
): Promise<void> {
  const result = await db.from("findings").delete().eq("id", findingId);
  if (result.error) {
    throw new Error(`deleteFindingById: ${result.error.message}`);
  }
}

/**
 * Resets an analysis to GENERATING before a run.
 *
 * Ingestion left the analysis DONE (its three jobs finished and
 * recompute_analysis_status flipped it). Starting the real analysis must clear
 * that terminal state, or the report would render as complete with zero
 * results. Also clears any prior score/error so a re-run starts clean.
 */
export async function resetAnalysisForRun(
  db: Db,
  analysisId: string,
): Promise<void> {
  const result = await db
    .from("paper_analyses")
    .update({
      status: "GENERATING",
      overall_score: null,
      error_reason: null,
      error_message: null,
      completed_at: null,
      started_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  if (result.error) {
    throw new Error(`resetAnalysisForRun: ${result.error.message}`);
  }
}

/** Writes the pre-flight cost estimate. */
export async function setEstimatedCost(
  db: Db,
  analysisId: string,
  estimatedCostUsd: number,
): Promise<void> {
  const result = await db
    .from("paper_analyses")
    .update({ estimated_cost_usd: estimatedCostUsd })
    .eq("id", analysisId);

  if (result.error) {
    throw new Error(`setEstimatedCost: ${result.error.message}`);
  }
}

/** Writes the final overall score and completion timestamp. */
export async function setAnalysisScore(
  db: Db,
  analysisId: string,
  overallScore: number | null,
): Promise<void> {
  const result = await db
    .from("paper_analyses")
    .update({
      overall_score: overallScore,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  if (result.error) {
    throw new Error(`setAnalysisScore: ${result.error.message}`);
  }
}

/**
 * Marks the analysis errored with a machine-readable reason.
 *
 * Used by the cost guard (COST_CEILING) and the all-failed case. The analysis
 * keeps whatever completed check_results it already has — partial value beats a
 * blank failure.
 */
export async function setAnalysisError(
  db: Db,
  analysisId: string,
  reason: string,
  message: string | null = null,
): Promise<void> {
  const result = await db
    .from("paper_analyses")
    .update({
      status: "ERROR",
      error_reason: reason,
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  if (result.error) {
    throw new Error(`setAnalysisError: ${result.error.message}`);
  }
}

/** Running LLM spend for an analysis, from the token_usage ledger. */
export async function getAnalysisCostSoFar(
  db: Db,
  analysisId: string,
): Promise<number> {
  const result = await db
    .from("token_usage")
    .select("cost_usd")
    .eq("paper_analysis_id", analysisId);

  const rows = unwrap(result, "getAnalysisCostSoFar");
  return rows.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
}

/** Cancels still-pending check jobs — used when the cost ceiling is hit. */
export async function cancelPendingCheckJobs(
  db: Db,
  analysisId: string,
  reason: string,
): Promise<number> {
  const kinds: Database["public"]["Enums"]["job_kind"][] = [
    "RUN_CHECK",
    "GRAMMAR",
  ];
  const result = await db
    .from("analysis_jobs")
    .update({
      status: "ERROR",
      last_error: reason,
      completed_at: new Date().toISOString(),
    })
    .eq("paper_analysis_id", analysisId)
    .in("kind", kinds)
    .in("status", ["NONE", "GENERATING"] satisfies JobStatus[])
    .select("id");

  if (result.error) {
    throw new Error(`cancelPendingCheckJobs: ${result.error.message}`);
  }
  return result.data?.length ?? 0;
}
