import * as React from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import type { PaperCardView } from "@/lib/papers/presentation";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusPill } from "@/components/shared/StatusPill";
import { IconArrowRight } from "@/components/icons";
import { IconMotion } from "@/components/motion/IconMotion";

/**
 * The dashboard's recent-activity column.
 *
 * Deliberately NOT the papers grid in miniature. The library card carries a
 * sparkline, a version count, a score chip and an actions menu; repeating that
 * here would make the dashboard a worse copy of a page one click away. This
 * row answers one question — what happened lately, and does it need me — so it
 * shows the title, the state, and the open count.
 *
 * A server component. `StatusPill` is a client leaf and stays one; nothing
 * else here needs the browser.
 */
export interface RecentPapersProps {
  papers: readonly PaperCardView[];
  /** Lets the bento cell stretch this card to its grid row. */
  className?: string;
}

export async function RecentPapers({ papers, className }: RecentPapersProps) {
  const t = await getTranslations("dashboard.recent");
  const tPapers = await getTranslations("papers");
  const format = await getFormatter();

  return (
    <SectionCard
      /* No almond gradient: on the landing page that is reserved for tiles
         carrying a miniature, and this is a list. No `edge` either — see the
         note in `DashboardContent`. */
      className={cn("border-transparent", className)}
      title={t("title")}
      headerAction={
        <Link
          href={ROUTES.papers}
          className="text-meta text-primary inline-flex items-center gap-1 font-medium hover:underline"
        >
          {t("viewAll")}
          <IconMotion within="a">
            <IconArrowRight aria-hidden="true" className="size-3.5" />
          </IconMotion>
        </Link>
      }
      padded={false}
    >
      <ul className="rise-stagger divide-border divide-y">
        {papers.map((paper, index) => {
          const href = paper.currentAnalysisId
            ? `/analysis/${paper.currentAnalysisId}`
            : `/upload?paperId=${paper.paperId}`;

          return (
            <li
              key={paper.paperId}
              style={{ "--i": index } as React.CSSProperties}
            >
              <Link
                href={href}
                /* The 2px slide is the sidebar row's, verbatim. On a list
                   where every row is the same shape, a colour shift alone is a
                   weak signal — the small horizontal move is what makes the
                   row feel like it answered you. */
                className="hover:bg-primary-soft/30 ease-out-quiet group/row flex items-center gap-3 px-5 py-3.5 transition-[background-color,transform] duration-200 hover:translate-x-0.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-body text-ink block truncate font-medium">
                    {paper.title || tPapers("untitled")}
                  </span>
                  <span className="text-meta text-muted-soft mt-0.5 block">
                    {/*
                     * `dateTime` with a relative style needs a stable "now" to
                     * compare against, and next-intl's formatter resolves that
                     * on the server for a server render — so this cannot
                     * disagree with the client the way `new Date()` inline
                     * would.
                     */}
                    {format.relativeTime(new Date(paper.updatedAt))}
                    {paper.openIssues > 0
                      ? ` · ${t("openCount", { count: paper.openIssues })}`
                      : null}
                  </span>
                </span>

                {paper.currentStatus ? (
                  <StatusPill status={paper.currentStatus} size="sm" />
                ) : null}

                {/*
                 * The row says where it goes only once you are on it. It holds
                 * its 14px of width at all times — revealing by animating width
                 * would reflow the title on every hover, and a truncated title
                 * that re-truncates under the pointer is worse than no arrow.
                 *
                 * `aria-hidden`: the row is already a link with an accessible
                 * name, and an arrow announcing "link" a second time is noise.
                 */}
                <IconArrowRight
                  aria-hidden="true"
                  className="text-primary ease-out-quiet size-3.5 shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover/row:translate-x-0 group-hover/row:opacity-100"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
