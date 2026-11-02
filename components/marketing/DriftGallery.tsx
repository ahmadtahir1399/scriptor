import * as React from "react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";
import type { DriftDepth } from "@/lib/constants";
import { Drift } from "@/components/marketing/Drift";
import { RevealOnView } from "@/components/marketing/RevealOnView";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import {
  CheckSurface,
  DefenseSurface,
  FindingSurface,
  ReferenceSurface,
  ScoreSurface,
  TodoSurface,
} from "@/components/marketing/Surfaces";

/**
 * A drifting column whose cards each reveal themselves on entry.
 *
 * `React.Children.map` rather than making every caller wrap its own cards:
 * twelve hand-written `RevealOnView` wrappers is twelve chances to forget one,
 * and the index is exactly the stagger delay this needs anyway.
 */
function GalleryColumn({
  depth,
  className,
  children,
}: Readonly<{
  depth: DriftDepth;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <Drift depth={depth} className={cn("flex flex-col gap-4 lg:gap-5", className)}>
      {React.Children.map(children, (child, index) => (
        <RevealOnView delay={index * 0.06}>{child}</RevealOnView>
      ))}
    </Drift>
  );
}

/**
 * The drift gallery — the page's signature scroll moment.
 *
 * Four columns of product surfaces travelling at four different speeds, two
 * against the scroll and two with it. The opposition is the whole effect: a
 * set of columns all drifting the same direction reads as the page scrolling
 * at the wrong speed, not as depth.
 *
 * The columns also start at staggered vertical offsets, so the layering is
 * visible before the visitor scrolls at all. Parallax that only exists in
 * motion is invisible to anyone who lands and does not move.
 *
 * Two layers of motion, deliberately separated: the COLUMN drifts continuously
 * with scroll position, while each CARD plays a one-shot reveal as it arrives.
 * Continuous motion gives the section depth; the one-shot gives each card a
 * moment. Running both continuously would be noise.
 *
 * Every card is a real product surface, not a screenshot — see the note in
 * `Surfaces.tsx` for which are the product's own components and which are
 * specimens. Nothing here is an image, so it stays sharp at any density,
 * re-themes in dark mode, and translates.
 *
 * `overflow-hidden` on the section is load-bearing: the columns travel beyond
 * their laid-out bounds and would otherwise extend the document and create a
 * horizontal scrollbar at some viewport widths.
 */
export async function DriftGallery() {
  const t = await getTranslations("landing.gallery");

  return (
    <section
      // `id="report"`, not `anchored` — `AnchoredViewer` owns that anchor now,
      // and it is the section the nav's "how it works" link means. Two
      // elements sharing an id is invalid; the browser silently picks the first.
      id="report"
      className="bg-bg relative overflow-hidden py-20 lg:py-28"
    >
      <div className="relative z-10 mx-auto w-full max-w-295 px-6 lg:px-10">
        {/* Left, but with the rule eyebrow rather than the pill — `CheckCatalogue`
            already owns the pill, and two identical openings in one scroll is
            the sameness this variant set exists to break. */}
        <SectionHeader
          eyebrow={t("eyebrow")}
          headline={t("headline")}
          subhead={t("subhead")}
          variant="left"
          eyebrowStyle="rule"
        />

        {/*
         * Two columns on small screens, four from lg. The stagger offsets only
         * apply from lg — on a narrow viewport they would read as broken
         * alignment rather than as depth.
         */}
        <div className="mt-14 grid grid-cols-2 items-start gap-4 lg:mt-20 lg:grid-cols-4 lg:gap-5">
          <GalleryColumn depth="mid">
            <ScoreSurface score={78} caption={t("score.caption")} />
            <FindingSurface
              page={t("findings.citation.page")}
              check={t("findings.citation.check")}
              severity={t("findings.citation.severity")}
              tone="warning"
              before={t("findings.citation.before")}
              mark={t("findings.citation.mark")}
              after={t("findings.citation.after")}
              title={t("findings.citation.title")}
            />
            <ReferenceSurface
              citation={t("references.broken.citation")}
              health={t("references.broken.health")}
              tone="critical"
            />
          </GalleryColumn>

          <GalleryColumn depth="sink" className="lg:mt-16">
            <FindingSurface
              page={t("findings.gendering.page")}
              check={t("findings.gendering.check")}
              severity={t("findings.gendering.severity")}
              tone="verified"
              before={t("findings.gendering.before")}
              mark={t("findings.gendering.mark")}
              after={t("findings.gendering.after")}
              title={t("findings.gendering.title")}
            />
            <TodoSurface
              label={t("todos.label")}
              items={[
                { text: t("todos.a"), done: true },
                { text: t("todos.b"), done: false },
                { text: t("todos.c"), done: false },
              ]}
            />
            <CheckSurface name={t("checks.coherence")} score={84} />
          </GalleryColumn>

          <GalleryColumn depth="far" className="lg:mt-6">
            <ReferenceSurface
              citation={t("references.uncited.citation")}
              health={t("references.uncited.health")}
              tone="warning"
            />
            <FindingSurface
              page={t("findings.density.page")}
              check={t("findings.density.check")}
              severity={t("findings.density.severity")}
              tone="critical"
              before={t("findings.density.before")}
              mark={t("findings.density.mark")}
              after={t("findings.density.after")}
              title={t("findings.density.title")}
            />
            <DefenseSurface
              label={t("defense.label")}
              question={t("defense.question")}
              difficulty={t("defense.difficulty")}
              tone="ai"
            />
          </GalleryColumn>

          <GalleryColumn depth="near" className="lg:mt-24">
            <CheckSurface name={t("checks.argumentation")} score={71} />
            <FindingSurface
              page={t("findings.terminology.page")}
              check={t("findings.terminology.check")}
              severity={t("findings.terminology.severity")}
              tone="warning"
              before={t("findings.terminology.before")}
              mark={t("findings.terminology.mark")}
              after={t("findings.terminology.after")}
              title={t("findings.terminology.title")}
            />
            <ReferenceSurface
              citation={t("references.verified.citation")}
              health={t("references.verified.health")}
              tone="verified"
            />
          </GalleryColumn>
        </div>
      </div>
    </section>
  );
}
