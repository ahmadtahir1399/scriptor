import * as React from "react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import type { DashboardView } from "@/lib/dashboard/presentation";
import { ButtonLink } from "@/components/ui/button-link";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionCard } from "@/components/shared/SectionCard";
import { DashboardMotion } from "@/components/dashboard/DashboardMotion";
import { NextActionCard } from "@/components/dashboard/NextActionCard";
import { StandingCard } from "@/components/dashboard/StandingCard";
import { StatTile } from "@/components/dashboard/StatTile";
import { ScoreTrendChart } from "@/components/dashboard/ScoreTrendChart";
import { ScoreBars } from "@/components/dashboard/ScoreBars";
import { RecentPapers } from "@/components/dashboard/RecentPapers";
import {
  IconDrafts,
  IconFindings,
  IconLibrary,
  IconScore,
  IconSprout,
} from "@/components/icons";

/**
 * Everything the dashboard renders, given an already-derived view.
 *
 * Split from the page so the presentation takes a plain `DashboardView` and
 * knows nothing about sessions, Supabase or `getPapersLibrary`. The page does
 * the I/O; this does the pixels. That is what lets the layout be rendered
 * against fabricated data without standing up a session — otherwise the only
 * way to look at this screen is to sign in, which in practice means it never
 * gets looked at in the states that matter (empty, running, no-trend).
 *
 * No client JavaScript. Every animation here is a CSS keyframe driven by an
 * inline custom property.
 */
export interface DashboardContentProps {
  view: DashboardView;
  /** Resolved on the server — see the note in the page. */
  greeting: string;
  today: string;
}

export async function DashboardContent({
  view,
  greeting,
  today,
}: DashboardContentProps) {
  const t = await getTranslations("dashboard");

  if (view.isEmpty) {
    return (
      <div>
        <PageHeader eyebrow={today} title={greeting} />
        <SectionCard className="border-transparent">
          <EmptyState
            icon={IconSprout}
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              <ButtonLink href={ROUTES.upload}>{t("empty.cta")}</ButtonLink>
            }
          />
        </SectionCard>
      </div>
    );
  }

  const trend = view.trend;

  return (
    <div>
      {/* No subtitle. "Here is where your writing stands today" restated the
          page for no one — the eyebrow dates it and the cards say the rest. */}
      <PageHeader
        eyebrow={today}
        title={greeting}
        actions={<ButtonLink href={ROUTES.upload}>{t("empty.cta")}</ButtonLink>}
      />

      {/*
       * ── One bento, not three stacked bands ───────────────────────────────
       *
       * The old layout was hero row → stat row → panel row: three full-width
       * bands, every card within a band the same size. That reads as a form,
       * not a dashboard — nothing is more important than anything else, so
       * there is nowhere for the eye to land. This is a single asymmetric
       * grid in the landing page's bento language, where importance is
       * expressed by AREA.
       *
       * The spans tile EXACTLY at both breakpoints under plain row-major
       * auto-placement — no `dense`, no explicit line numbers, no orphan cell:
       *
       *      lg, 4 cols                        sm, 2 cols
       *      ┌───────────────┬──────┬──────┐   ┌─────────────┐
       *      │  NEXT ACTION  │SCORE │stat 1│   │ NEXT ACTION │
       *      │     (2×2)     │(1×2) ├──────┤   ├─────────────┤
       *      │               │      │stat 2│   │    SCORE    │
       *      ├───────────────┼──────┴──────┤   ├──────┬──────┤
       *      │  TREND (2×1)  │   RECENT    │   │stat 1│stat 2│
       *      ├───────┬───────┤    (2×2)    │   ├──────┴──────┤
       *      │stat 3 │stat 4 │             │   │    TREND    │
       *      └───────┴───────┴─────────────┘   ├─────────────┤
       *                                        │   RECENT    │
       *                                        ├──────┬──────┤
       *                                        │stat 3│stat 4│
       *                                        └──────┴──────┘
       *
       * Two stats now sit BESIDE the hero instead of under it, which is what
       * dissolves the old stat band and buys the vertical room the bento
       * needs. Nothing was added or removed — the same eight things are on
       * screen, arranged so the two that matter most are the two biggest.
       *
       * `grid-cols-1` at base and Tailwind's named column classes throughout:
       * those expand to `minmax(0,1fr)`, whereas a hand-written `1.35fr`
       * track has an automatic minimum that lets the chart's SVG push its
       * column past the viewport and scroll the whole page sideways.
       *
       * One `.rise-stagger` over the whole grid, `--i` per cell, so the page
       * assembles in a single order rather than three separate ripples.
       * Mount-triggered, not scroll-triggered like the landing page: this is
       * a working screen and it is all above the fold.
       *
       * ── Two layers of entrance, and they do different jobs ─────────────
       * `.rise-stagger` moves the CARDS. `DashboardMotion` moves what is
       * INSIDE them — the icon wells, every glyph, the seeds, the delta chips
       * and the pine panel's leaf — on one anime.js timeline that starts after
       * the cards have begun to land. Cards in CSS keeps the grid a Server
       * Component and keeps the layout honest without JavaScript; the contents
       * in JS is what a stylesheet cannot do, because a stroke draw needs the
       * path and a sequence needs a shared clock.
       *
       * `DashboardMotion` renders this grid rather than wrapping it, so the
       * choreography costs no extra element.
       *
       * ── No edges on this screen: no border, and no pine rule ────────────
       * Every card here carries `border-transparent`, and none of them passes
       * `edge`. A bento is read as AREAS, and eight outlined rectangles fight
       * that by drawing eight boxes instead — the shadow and the pine panel
       * separate the cells perfectly well on their own.
       *
       * The pine rule went for a sharper reason than the hairline did. On the
       * landing page it appears on tiles standing on `bg-green-050`, where it
       * is a pine accent on a green ground. Here it is a near-black 2px bar on
       * cream at the exact left edge of every cell, which stops reading as an
       * accent and starts reading as a heavy rule — six of them stacked down a
       * grid, all in the same place, is a ledger.
       *
       * `SectionCard` keeps the `edge` prop and `PaperCard` keeps its own rule
       * (score-toned, and one card per row rather than a column of them). This
       * is a decision about the dashboard, not a retraction of the device.
       *
       * `border-transparent` rather than `border-0` throughout, so the pixel
       * stays in the box and a card with `hover:border-primary/35` does not
       * jump when the pointer arrives.
       */}
      <DashboardMotion className="rise-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        <div
          className="sm:col-span-2 lg:row-span-2"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <NextActionCard
            action={view.nextAction}
            runningCount={view.runningCount}
          />
        </div>

        <div
          className="sm:col-span-2 lg:col-span-1 lg:row-span-2"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <StandingCard
            score={view.overallScore}
            paperCount={view.stats.papersAnalysed}
            runningCount={view.runningCount}
          />
        </div>

        <StatTile
          index={2}
          icon={IconLibrary}
          label={t("stats.papers")}
          value={view.stats.papersAnalysed}
        />
        <StatTile
          index={3}
          icon={IconFindings}
          label={t("stats.openIssues")}
          value={view.stats.openIssues}
        />

        <SectionCard
          /*
           * `lift` matches the landing page's tiles. Safe on a card this size
           * — the rule in `globals.css` is only against putting it on rows
           * inside a dense table. `h-full` because a bento cell is stretched
           * by its row, and a short chart would otherwise leave the card
           * floating above a gap.
           *
           * The almond gradient follows the landing page's own rule for it:
           * there it goes on the tiles that CARRY A MINIATURE, not on every
           * tile. This card carries the chart, so it is the dashboard's
           * equivalent — and the plain stat tiles stay plain, which is what
           * keeps the gradient meaning something.
           */
          className="lift hover:border-primary/35 from-surface to-primary-soft/35 h-full border-transparent bg-linear-to-br sm:col-span-2"
          style={{ "--i": 4 } as React.CSSProperties}
          title={trend ? t("trend.title") : t("trend.byPaperTitle")}
          /* Only the trend names its paper — the bar list already labels every
             row, so a subtitle there would just repeat the card title. */
          description={
            trend ? t("trend.subtitle", { title: trend.paperTitle }) : undefined
          }
          /*
           * The axis is fixed at 0–100 so a two-point wobble is not
           * exaggerated into a cliff — which is correct, but it also means a
           * real 22-point climb reads as a gentle slope. The chip states the
           * magnitude in words so the change is legible without the chart
           * having to lie about the scale.
           */
          headerAction={
            trend && trend.delta !== null && trend.delta !== 0 ? (
              <span
                data-dash="chip"
                className={cn(
                  "rounded-sm px-2 py-0.5 text-micro font-medium whitespace-nowrap",
                  trend.delta > 0
                    ? "bg-verified-soft text-verified"
                    : "bg-critical-soft text-critical",
                )}
              >
                {trend.delta > 0
                  ? t("trend.deltaUp", { delta: trend.delta })
                  : t("trend.deltaDown", { delta: trend.delta })}
              </span>
            ) : null
          }
        >
          {trend ? (
            <ScoreTrendChart
              points={trend.points}
              label={t("trend.label", {
                count: trend.points.length,
                title: trend.paperTitle,
                from: trend.points[0]?.score ?? 0,
                to: trend.points[trend.points.length - 1]?.score ?? 0,
              })}
              pointLabels={trend.points.map((point) =>
                t("trend.point", {
                  version: point.versionNumber,
                  score: point.score,
                }),
              )}
            />
          ) : view.byPaper.length > 0 ? (
            /*
             * No paper has a second draft yet, so there is no progression to
             * plot. Rather than frame an empty chart, the slot compares the
             * scores that DO exist — real information, and it keeps the card
             * the same visual weight as the one beside it.
             */
            <ScoreBars papers={view.byPaper} />
          ) : (
            <EmptyState
              icon={IconDrafts}
              title={t("trend.emptyTitle")}
              description={t("trend.emptyBody")}
              className="py-6"
            />
          )}
        </SectionCard>

        <div
          className="sm:col-span-2 lg:row-span-2"
          style={{ "--i": 5 } as React.CSSProperties}
        >
          <RecentPapers papers={view.recent} className="h-full" />
        </div>

        <StatTile
          index={6}
          icon={IconScore}
          label={t("stats.averageScore")}
          value={view.stats.averageScore}
        />
        <StatTile
          index={7}
          icon={IconDrafts}
          label={t("stats.versions")}
          value={view.stats.versions}
        />
      </DashboardMotion>
    </div>
  );
}
