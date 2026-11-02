import type { AnalysisStatus } from "@/lib/db/enums";
import type { CheckCategory } from "@/lib/analysis/config";
import { computeAnalysisScore } from "@/lib/analysis/scoring";
import { toCheckRatings } from "@/lib/analysis/presentation";
import type { CheckResultWithVersion } from "@/lib/domain/analysis";

/**
 * Papers-library presentation.
 *
 * PURE — no I/O, no database, no clock. It ARRANGES what the queries return into
 * the card and version view-models the UI renders, and it derives the version
 * numbering, the score delta and the sparkline points. It computes NO scoring
 * math itself: category scores come straight from `computeAnalysisScore`, the
 * single source of that truth. The overall/version scores it passes through are
 * the ones P4 already stored (themselves the output of the same function).
 */

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export interface VersionScorePoint {
  versionNumber: number;
  score: number | null;
}

export interface PaperCardView {
  paperId: string;
  title: string;
  documentTypeCode: string | null;
  fileName: string | null;
  currentAnalysisId: string | null;
  currentStatus: AnalysisStatus | null;
  currentScore: number | null;
  versionCount: number;
  openIssues: number;
  /** Last activity — newest analysis timestamp. */
  updatedAt: string;
  /** Score per version, oldest → newest, for the sparkline. */
  scores: VersionScorePoint[];
  /** Current minus previous version score, or null when there is no prior. */
  delta: number | null;
}

export interface CategoryScoreView {
  category: CheckCategory;
  score: number | null;
}

export interface VersionView {
  uploadId: string;
  analysisId: string | null;
  versionNumber: number;
  isCurrent: boolean;
  status: AnalysisStatus | null;
  overall: number | null;
  categories: CategoryScoreView[];
  pageCount: number | null;
  wordCount: number | null;
  uploadedAt: string;
}

export interface PaperDetailView {
  paperId: string;
  title: string;
  documentTypeCode: string | null;
  versions: VersionView[];
  /** Oldest → newest, for the trend chart. */
  trend: VersionScorePoint[];
  /** Current minus previous version score. */
  currentDelta: number | null;
}

// ---------------------------------------------------------------------------
// Raw inputs (decoupled from DB row types so this stays testable)
// ---------------------------------------------------------------------------

export interface AnalysisLite {
  id: string;
  paperUploadId: string;
  status: AnalysisStatus;
  overall: number | null;
  createdAt: string;
}

interface VersionAggregate {
  uploadId: string;
  latest: AnalysisLite;
  firstCreated: string;
}

/**
 * Collapses an analysis list into one entry per upload (version): each upload's
 * LATEST analysis is its representative, and versions order by when the upload
 * first appeared. A re-analysed upload keeps one version slot, showing its most
 * recent run.
 */
export function aggregateVersions(
  analyses: readonly AnalysisLite[],
): VersionAggregate[] {
  const byUpload = new Map<string, AnalysisLite[]>();
  for (const analysis of analyses) {
    const list = byUpload.get(analysis.paperUploadId);
    if (list) list.push(analysis);
    else byUpload.set(analysis.paperUploadId, [analysis]);
  }

  const aggregates: VersionAggregate[] = [];
  for (const [uploadId, list] of byUpload) {
    const sorted = [...list].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    aggregates.push({
      uploadId,
      latest: sorted[sorted.length - 1] as AnalysisLite,
      firstCreated: sorted[0]?.createdAt ?? "",
    });
  }

  return aggregates.sort((a, b) =>
    a.firstCreated.localeCompare(b.firstCreated),
  );
}

/** Current minus the previous version's score, when both are known. */
export function scoreDelta(
  scores: readonly VersionScorePoint[],
  currentIndex: number,
): number | null {
  const current = scores[currentIndex]?.score;
  const previous = scores[currentIndex - 1]?.score;
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined
  ) {
    return null;
  }
  return Number((current - previous).toFixed(1));
}

// ---------------------------------------------------------------------------
// Card view builder
// ---------------------------------------------------------------------------

export interface BuildPaperCardInput {
  paperId: string;
  title: string;
  documentTypeCode: string | null;
  fileName: string | null;
  currentAnalysisId: string | null;
  createdAt: string;
  analyses: readonly AnalysisLite[];
  openIssues: number;
}

export function buildPaperCardView(input: BuildPaperCardInput): PaperCardView {
  const versions = aggregateVersions(input.analyses);

  const scores: VersionScorePoint[] = versions.map((version, index) => ({
    versionNumber: index + 1,
    score: version.latest.overall,
  }));

  // The current version is the one whose latest analysis is the paper's current
  // analysis; fall back to the newest version when that link is missing.
  let currentIndex = versions.findIndex(
    (v) => v.latest.id === input.currentAnalysisId,
  );
  if (currentIndex === -1) currentIndex = versions.length - 1;

  const current = versions[currentIndex]?.latest ?? null;
  const updatedAt =
    input.analyses.reduce<string>(
      (max, a) => (a.createdAt > max ? a.createdAt : max),
      "",
    ) || input.createdAt;

  return {
    paperId: input.paperId,
    title: input.title,
    documentTypeCode: input.documentTypeCode,
    fileName: input.fileName,
    currentAnalysisId: current?.id ?? input.currentAnalysisId,
    currentStatus: current?.status ?? null,
    currentScore: current?.overall ?? null,
    versionCount: versions.length,
    openIssues: input.openIssues,
    updatedAt,
    scores,
    delta: currentIndex >= 0 ? scoreDelta(scores, currentIndex) : null,
  };
}

// ---------------------------------------------------------------------------
// Category scores — the ONLY place version categories are computed, via scoring.ts
// ---------------------------------------------------------------------------

export function categoryScores(
  results: readonly CheckResultWithVersion[],
): CategoryScoreView[] {
  const { categories } = computeAnalysisScore(toCheckRatings(results));
  return categories.map((category) => ({
    category: category.category,
    score: category.score,
  }));
}

// ---------------------------------------------------------------------------
// Sorting (client-side control)
// ---------------------------------------------------------------------------

export const PAPER_SORTS = ["updated", "title", "score"] as const;
export type PaperSort = (typeof PAPER_SORTS)[number];

export function sortPaperCards(
  cards: readonly PaperCardView[],
  sort: PaperSort,
): PaperCardView[] {
  const copy = [...cards];
  switch (sort) {
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "score":
      return copy.sort(
        (a, b) => (b.currentScore ?? -1) - (a.currentScore ?? -1),
      );
    case "updated":
    default:
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

/** Trend points (oldest → newest) for the detail-page chart. */
export function buildTrend(
  versions: readonly VersionView[],
): VersionScorePoint[] {
  return [...versions]
    .sort((a, b) => a.versionNumber - b.versionNumber)
    .map((version) => ({
      versionNumber: version.versionNumber,
      score: version.overall,
    }));
}
