import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import type { DashboardView } from "@/lib/dashboard/presentation";
import type { PaperCardView } from "@/lib/papers/presentation";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

/**
 * DEVELOPMENT ONLY — a dashboard you can actually look at.
 *
 * `DashboardContent` takes a plain `DashboardView`, and its own doc comment
 * says why: "otherwise the only way to look at this screen is to sign in,
 * which in practice means it never gets looked at in the states that matter
 * (empty, running, no-trend)". This route is that escape hatch made real —
 * the layout rendered against fabricated data, no session, no database.
 *
 * `notFound()` outside development, so it cannot ship. It is a 404 in
 * production even though the file is in the bundle; delete the folder if you
 * would rather it not exist at all.
 *
 * The data below is invented and deliberately obvious about it. Nothing here
 * is reachable from the app's navigation.
 */
const paper = (
  n: number,
  score: number,
  openIssues: number,
): PaperCardView => ({
  paperId: `p${n}`,
  title: `Working paper ${n}: institutional isomorphism in emerging markets`,
  documentTypeCode: "MASTER",
  fileName: `draft-${n}.pdf`,
  currentAnalysisId: `a${n}`,
  currentStatus: "DONE",
  currentScore: score,
  versionCount: 3,
  openIssues,
  updatedAt: new Date(Date.UTC(2026, 7, 3 + n)).toISOString(),
  scores: [
    { versionNumber: 1, score: score - 9 },
    { versionNumber: 2, score: score - 4 },
    { versionNumber: 3, score },
  ],
  delta: 4,
});

const view: DashboardView = {
  isEmpty: false,
  stats: {
    papersAnalysed: 4,
    openIssues: 23,
    averageScore: 78,
    versions: 11,
  },
  overallScore: 78,
  runningCount: 0,
  nextAction: {
    paperId: "p1",
    analysisId: "a1",
    title: "Working paper 1: institutional isomorphism in emerging markets",
    openIssues: 12,
    status: "DONE",
    score: 71,
  },
  trend: {
    paperId: "p1",
    paperTitle: "Institutional isomorphism in emerging markets",
    points: [
      { versionNumber: 1, score: 56 },
      { versionNumber: 2, score: 64 },
      { versionNumber: 3, score: 71 },
      { versionNumber: 4, score: 78 },
    ],
    delta: 22,
  },
  byPaper: [],
  recent: [paper(1, 71, 12), paper(2, 84, 5), paper(3, 66, 6), paper(4, 91, 0)],
};

export default async function LayoutPreviewPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="bg-bg min-h-svh px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-295">
        <DashboardContent
          view={view}
          greeting="Good evening"
          today="Monday, 10 August"
        />
      </div>
    </div>
  );
}
