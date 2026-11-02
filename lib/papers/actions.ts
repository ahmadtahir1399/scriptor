"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  countOpenFindings,
  getPaper,
  getUpload,
  listAnalysesForUser,
  listPapers,
  listUploadsForPaper,
  type Db,
} from "@/lib/db/queries/papers";
import {
  getAnalysis,
  getAnalysisWithResults,
  listAnalysesForPaper,
} from "@/lib/db/queries/analyses";
import { listChecksForDocumentType } from "@/lib/db/queries/checks";
import {
  createAnalysis,
  deletePaper as deletePaperRow,
  requeueFailedJobs,
  setCurrentUpload,
  updatePaperTitle,
} from "@/lib/db/queries/uploads";
import { enqueueAnalysis } from "@/lib/analysis/enqueue";
import { kickWorker } from "@/lib/jobs/kick";
import type { AppLocale } from "@/lib/db/enums";
import type { PaperUpload } from "@/lib/domain/paper";
import {
  buildPaperCardView,
  buildTrend,
  categoryScores,
  scoreDelta,
  type AnalysisLite,
  type PaperCardView,
  type PaperDetailView,
  type VersionView,
} from "@/lib/papers/presentation";
import {
  deletePaperSchema,
  reanalyseAnalysisSchema,
  reanalysePaperSchema,
  retryAnalysisSchema,
  updatePaperSchema,
} from "@/lib/validations/paper";

/**
 * Papers-library server actions.
 *
 * Reads assemble the library and detail view-models (queries + pure
 * presentation); mutations re-derive the user from the session and re-verify
 * ownership before any write. Re-analyse routes through P4's engine and
 * new-version through P2's upload flow — no forked orchestration lives here.
 */

export type PaperActionResult = { ok: true } | { ok: false; error: string };
export type ReanalyseResult =
  { ok: true; analysisId: string } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The whole library as card view-models. Seeds the page and the live hook. */
export async function getPapersLibrary(): Promise<PaperCardView[]> {
  await requireSessionUser();
  const db = await createClient();

  const [papers, analyses] = await Promise.all([
    listPapers(db),
    listAnalysesForUser(db),
  ]);

  const analysesByPaper = new Map<string, AnalysisLite[]>();
  for (const analysis of analyses) {
    const lite: AnalysisLite = {
      id: analysis.id,
      paperUploadId: analysis.paper_upload_id,
      status: analysis.status,
      overall: analysis.overall_score,
      createdAt: analysis.created_at,
    };
    const list = analysesByPaper.get(analysis.paper_id);
    if (list) list.push(lite);
    else analysesByPaper.set(analysis.paper_id, [lite]);
  }

  // Open-issue counts, once per paper's CURRENT analysis only.
  const currentIds = papers
    .map((paper) => paper.current_analysis_id)
    .filter((id): id is string => id !== null);
  const openEntries = await Promise.all(
    currentIds.map(
      async (id) => [id, await countOpenFindings(db, id)] as const,
    ),
  );
  const openByAnalysis = new Map<string, number>(openEntries);

  return papers.map((paper) =>
    buildPaperCardView({
      paperId: paper.id,
      title: paper.title || paper.current_upload?.file_name || "",
      documentTypeCode: paper.current_upload?.document_type_code ?? null,
      fileName: paper.current_upload?.file_name ?? null,
      currentAnalysisId: paper.current_analysis_id,
      createdAt: paper.created_at,
      analyses: analysesByPaper.get(paper.id) ?? [],
      openIssues: paper.current_analysis_id
        ? (openByAnalysis.get(paper.current_analysis_id) ?? 0)
        : 0,
    }),
  );
}

/** The detail view-model for one paper, or null when not found / not owned. */
export async function getPaperDetail(
  paperId: string,
): Promise<PaperDetailView | null> {
  const user = await requireSessionUser();
  const db = await createClient();

  const paper = await getPaper(db, paperId);
  if (!paper || paper.user_id !== user.id) return null;

  const [uploads, analyses] = await Promise.all([
    listUploadsForPaper(db, paperId),
    listAnalysesForPaper(db, paperId),
  ]);

  // Version number is the upload's chronological position (oldest = 1).
  const numberByUpload = new Map<string, number>();
  [...uploads]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((upload, index) => numberByUpload.set(upload.id, index + 1));

  // Newest first for display.
  const uploadsNewestFirst = [...uploads].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  const versions: VersionView[] = [];
  for (const upload of uploadsNewestFirst) {
    const latest = analyses
      .filter((analysis) => analysis.paper_upload_id === upload.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

    let categories: VersionView["categories"] = [];
    if (latest) {
      const withResults = await getAnalysisWithResults(db, latest.id);
      if (withResults) categories = categoryScores(withResults.check_results);
    }

    versions.push({
      uploadId: upload.id,
      analysisId: latest?.id ?? null,
      versionNumber: numberByUpload.get(upload.id) ?? 0,
      isCurrent: upload.id === paper.current_upload_id,
      status: latest?.status ?? null,
      overall: latest?.overall_score ?? null,
      categories,
      pageCount: upload.page_count,
      wordCount: upload.word_count,
      uploadedAt: upload.created_at,
    });
  }

  const trend = buildTrend(versions);
  const current = versions.find((version) => version.isCurrent);
  const currentDelta = current
    ? scoreDelta(trend, current.versionNumber - 1)
    : null;

  return {
    paperId: paper.id,
    title: paper.title || uploadsNewestFirst[0]?.file_name || "",
    documentTypeCode: uploadsNewestFirst[0]?.document_type_code ?? null,
    versions,
    trend,
    currentDelta,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Renames a paper. Ownership re-verified against the session. */
export async function renamePaper(input: unknown): Promise<PaperActionResult> {
  const parsed = updatePaperSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const paper = await getPaper(db, parsed.data.paperId);
    if (!paper || paper.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await updatePaperTitle(admin, parsed.data.paperId, parsed.data.title);

    revalidatePath("/papers");
    revalidatePath(`/papers/${parsed.data.paperId}`);
    return { ok: true };
  } catch (error) {
    console.error("[papers] renamePaper failed", error);
    return { ok: false, error: "unknown" };
  }
}

/** Deletes a paper and everything beneath it via the schema's ON DELETE cascade. */
export async function deletePaper(input: unknown): Promise<PaperActionResult> {
  const parsed = deletePaperSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const paper = await getPaper(db, parsed.data.paperId);
    if (!paper || paper.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await deletePaperRow(admin, parsed.data.paperId);

    revalidatePath("/papers");
    return { ok: true };
  } catch (error) {
    console.error("[papers] deletePaper failed", error);
    return { ok: false, error: "unknown" };
  }
}

/** Re-runs the current version of a paper — a fresh analysis over the same upload. */
export async function reanalyseCurrentVersion(
  input: unknown,
): Promise<ReanalyseResult> {
  const parsed = reanalysePaperSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const paper = await getPaper(db, parsed.data.paperId);
    if (!paper || paper.user_id !== user.id)
      return { ok: false, error: "not_found" };
    if (!paper.current_upload_id) return { ok: false, error: "no_version" };

    const upload = await getUpload(db, paper.current_upload_id);
    if (!upload || upload.is_compatible !== true)
      return { ok: false, error: "incompatible" };

    const admin = createAdminClient();
    const analysisId = await runReanalysis(admin, paper.id, upload);

    kickWorker();
    revalidatePath("/papers");
    revalidatePath(`/papers/${paper.id}`);
    return { ok: true, analysisId };
  } catch (error) {
    console.error("[papers] reanalyseCurrentVersion failed", error);
    return { ok: false, error: "unknown" };
  }
}

/** Re-runs the upload behind a given analysis — the report-header "Re-analyse". */
export async function reanalyseFromAnalysis(
  input: unknown,
): Promise<ReanalyseResult> {
  const parsed = reanalyseAnalysisSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const upload = await getUpload(db, analysis.paper_upload_id);
    if (!upload || upload.is_compatible !== true)
      return { ok: false, error: "incompatible" };

    const admin = createAdminClient();
    const analysisId = await runReanalysis(admin, analysis.paper_id, upload);

    kickWorker();
    revalidatePath("/papers");
    revalidatePath(`/papers/${analysis.paper_id}`);
    return { ok: true, analysisId };
  } catch (error) {
    console.error("[papers] reanalyseFromAnalysis failed", error);
    return { ok: false, error: "unknown" };
  }
}

/** Re-queues the failed jobs of one version's analysis. */
export async function retryVersionAnalysis(
  input: unknown,
): Promise<PaperActionResult> {
  const parsed = retryAnalysisSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();

    const analysis = await getAnalysis(db, parsed.data.analysisId);
    if (!analysis || analysis.user_id !== user.id)
      return { ok: false, error: "not_found" };

    const admin = createAdminClient();
    await requeueFailedJobs(admin, parsed.data.analysisId);

    kickWorker();
    revalidatePath(`/papers/${analysis.paper_id}`);
    return { ok: true };
  } catch (error) {
    console.error("[papers] retryVersionAnalysis failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Shared re-analysis path — creates a fresh analysis and fans it out.
// ---------------------------------------------------------------------------

async function runReanalysis(
  admin: Db,
  paperId: string,
  upload: PaperUpload,
): Promise<string> {
  // A fresh analysis row for the SAME upload — new run, not a reset.
  const analysis = await createAnalysis(admin, {
    paperId,
    uploadId: upload.id,
  });
  await setCurrentUpload(admin, paperId, upload.id, analysis.id);

  const checkIds = await resolveCheckIds(
    admin,
    upload.selected_check_ids,
    upload.document_type_code,
  );
  if (checkIds.length > 0) {
    await enqueueAnalysis(admin, {
      analysisId: analysis.id,
      uploadId: upload.id,
      checkIds,
      locale: (upload.locale ?? "EN") as AppLocale,
      wordCount: upload.word_count ?? 0,
    });
  }

  return analysis.id;
}

async function resolveCheckIds(
  db: Db,
  selected: readonly string[],
  documentTypeCode: string | null,
): Promise<string[]> {
  if (selected.length > 0) return [...selected];
  if (!documentTypeCode) return [];
  const checks = await listChecksForDocumentType(db, documentTypeCode);
  return checks
    .map((check) => check.id)
    .filter((id): id is string => id !== null);
}
