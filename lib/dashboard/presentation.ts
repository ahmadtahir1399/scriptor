import type { AnalysisStatus } from "@/lib/db/enums";
import type { PaperCardView } from "@/lib/papers/presentation";

/**
 * The dashboard view-model.
 *
 * Pure derivation over the library the papers page already loads — the
 * dashboard adds NO new database round trips. That is deliberate: the database
 * is in Tokyo and every extra query is ~230–490ms on the critical path of the
 * screen a returning student sees first.
 *
 * Everything here is a total function of `PaperCardView[]`, so it is testable
 * without a database and cannot drift from what the library shows.
 */

export interface DashboardStats {
  /** Papers that have at least one analysis. */
  papersAnalysed: number;
  /** Open findings across every current analysis. */
  openIssues: number;
  /** Mean of the current scores, or null when nothing has scored yet. */
  averageScore: number | null;
  /** Total uploaded versions — the count of revisions done. */
  versions: number;
}

/** The single "do this next" recommendation. */
export interface NextActionView {
  paperId: string;
  analysisId: string | null;
  title: string;
  openIssues: number;
  status: AnalysisStatus | null;
  score: number | null;
}

/**
 * A version that actually has a score.
 *
 * `VersionScorePoint.score` is nullable because a version can be mid-analysis
 * or errored. The chart cannot plot a null, so `pickTrend` filters them out —
 * and this type is what records that, rather than leaving every consumer to
 * re-assert it with a non-null assertion.
 */
export interface ScoredVersionPoint {
  versionNumber: number;
  score: number;
}

export interface TrendView {
  paperId: string;
  paperTitle: string;
  points: ScoredVersionPoint[];
  /** Newest minus oldest scored version. */
  delta: number | null;
}

/** One scored paper, for the comparison shown before any trend exists. */
export interface PaperScoreView {
  paperId: string;
  title: string;
  score: number;
}

export interface DashboardView {
  isEmpty: boolean;
  stats: DashboardStats;
  /** Drives the signature arc. Same value as `stats.averageScore`. */
  overallScore: number | null;
  /** Analyses currently running — the dashboard says so rather than showing a stale score. */
  runningCount: number;
  nextAction: NextActionView | null;
  trend: TrendView | null;
  /**
   * Fallback for the trend slot. Until a paper has been revised there is no
   * progression to plot, and an empty chart frame is a hole in the page —
   * so the same slot compares the papers that DO have a score. Highest first,
   * because the interesting end of that list is the bottom.
   */
  byPaper: PaperScoreView[];
  recent: PaperCardView[];
}

/** How many papers the "recent" column shows before it stops being scannable. */
const RECENT_LIMIT = 5;

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

/**
 * Picks the paper to work on next.
 *
 * Ranked by open findings descending, then by the weakest score — a paper with
 * fifteen open issues outranks one with three, and at equal counts the one
 * scoring worse is the one that needs the attention.
 *
 * A running analysis is never recommended: there is nothing to act on until it
 * finishes, and pointing someone at a half-written report is worse than
 * pointing them nowhere. `runningCount` carries that state instead.
 */
export function pickNextAction(
  papers: readonly PaperCardView[],
): NextActionView | null {
  const actionable = papers.filter(
    (paper) => paper.currentStatus === "DONE" && paper.openIssues > 0,
  );

  if (actionable.length === 0) return null;

  const [best] = [...actionable].sort((a, b) => {
    if (b.openIssues !== a.openIssues) return b.openIssues - a.openIssues;
    return (a.currentScore ?? 101) - (b.currentScore ?? 101);
  });

  if (!best) return null;

  return {
    paperId: best.paperId,
    analysisId: best.currentAnalysisId,
    title: best.title,
    openIssues: best.openIssues,
    status: best.currentStatus,
    score: best.currentScore,
  };
}

/**
 * The trend chart's series.
 *
 * A cross-paper aggregate would be dishonest — the scores belong to different
 * documents assessed against different checks, so averaging them over time
 * plots a number nobody can act on. Instead this shows ONE paper's score
 * across its own versions, which is a real progression, and the caption names
 * it so the axis is never ambiguous.
 *
 * Chooses the most recently active paper that has at least two scored
 * versions; returns null when no paper has been revised yet, and the UI shows
 * an explanation rather than an empty frame.
 */
export function pickTrend(papers: readonly PaperCardView[]): TrendView | null {
  const candidates = papers
    .map((paper) => ({
      paper,
      points: paper.scores.filter(
        (point): point is ScoredVersionPoint => point.score !== null,
      ),
    }))
    .filter((candidate) => candidate.points.length >= 2)
    .sort(
      (a, b) =>
        Date.parse(b.paper.updatedAt) - Date.parse(a.paper.updatedAt),
    );

  const chosen = candidates[0];
  if (!chosen) return null;

  const first = chosen.points[0];
  const last = chosen.points[chosen.points.length - 1];

  return {
    paperId: chosen.paper.paperId,
    paperTitle: chosen.paper.title,
    points: chosen.points,
    delta: first && last ? last.score - first.score : null,
  };
}

export function buildDashboard(
  papers: readonly PaperCardView[],
): DashboardView {
  const analysed = papers.filter((paper) => paper.currentAnalysisId !== null);
  const scores = papers
    .map((paper) => paper.currentScore)
    .filter((score): score is number => score !== null);

  const averageScore = mean(scores);

  return {
    isEmpty: papers.length === 0,
    stats: {
      papersAnalysed: analysed.length,
      openIssues: papers.reduce((sum, paper) => sum + paper.openIssues, 0),
      averageScore,
      versions: papers.reduce((sum, paper) => sum + paper.versionCount, 0),
    },
    overallScore: averageScore,
    runningCount: papers.filter((paper) => paper.currentStatus === "GENERATING")
      .length,
    nextAction: pickNextAction(papers),
    trend: pickTrend(papers),
    byPaper: papers
      .filter(
        (paper): paper is PaperCardView & { currentScore: number } =>
          paper.currentScore !== null,
      )
      .map((paper) => ({
        paperId: paper.paperId,
        title: paper.title,
        score: paper.currentScore,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RECENT_LIMIT),
    recent: [...papers]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, RECENT_LIMIT),
  };
}

/**
 * Which greeting to show.
 *
 * Resolved on the SERVER and passed down as a prop. Deriving it in a client
 * component would let the server and the browser disagree across a midnight or
 * timezone boundary, and a hydration mismatch on the largest words on the page
 * is the most visible kind there is.
 */
export type TimeOfDay = "morning" | "afternoon" | "evening";

export function timeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
