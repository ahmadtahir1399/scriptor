import { getTranslations } from "next-intl/server";

import { ROUTES } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/button-link";
import { AnchoredSpecimen } from "@/components/marketing/AnchoredSpecimen";
import { DocumentField } from "@/components/marketing/DocumentField";
import { Drift } from "@/components/marketing/Drift";
import { RevealOnView } from "@/components/marketing/RevealOnView";
import { SpecimenMotion } from "@/components/marketing/SpecimenMotion";
import { WordReveal } from "@/components/marketing/WordReveal";
import {
  IconFileQuestion,
  IconLeaf,
  IconLibrary,
  IconSprout,
} from "@/components/icons";
import { IconMotion } from "@/components/motion/IconMotion";

/**
 * The brand statement.
 *
 * Linen ground, pine doing the structural work: the headline, the wordmark,
 * the primary action and the pillar marks are all green, so the page reads as
 * green on warm rather than warm with green trim. `globals.css` warns about
 * exactly that failure — "if a screenshot reads as a beige app with green
 * accents, the green has been under-used".
 *
 * One contrast rule drives several choices here. Honey (`--color-decor`) is
 * 2.17:1 on linen: it was legitimate as eyebrow text on the old pine panel and
 * is NOT legitimate on this ground. So honey survives only as the highlight
 * wash inside the specimen, and the eyebrow becomes pine on almond.
 *
 * Asymmetric rather than centred. A centred hero over a centred screenshot is
 * the shape every competitor uses, and it puts the claim and the evidence in a
 * queue instead of level with each other.
 *
 * Still a Server Component. The headline reveal is CSS over a server-side word
 * split; only `Drift`, `SpecimenMotion` and `DocumentField` cross into the
 * client.
 */
export async function Hero() {
  const tl = await getTranslations("landing");

  const pillars = [
    { key: "anchored", icon: IconFileQuestion },
    { key: "criteria", icon: IconLibrary },
    { key: "viva", icon: IconSprout },
  ] as const;

  return (
    <section className="bg-bg relative isolate min-h-[92svh] overflow-hidden">
      {/*
       * The thesis, being read. Masked top and bottom so it emerges from the
       * linen instead of being cropped by the section edge.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 mask-[linear-gradient(to_bottom,transparent,#000_16%,#000_74%,transparent)]"
      >
        <DocumentField className="size-full" />
      </div>

      {/*
       * Scrim. The copy column has to sit on effectively clean linen — this
       * project's contrast floor is computed against #F1E9DD, and letting a
       * moving texture through behind body text would invalidate every one of
       * those numbers. Opaque under the text, clearing by the right edge where
       * only the (opaque) specimen card sits.
       */}
      <div
        aria-hidden="true"
        className="from-bg via-bg/94 pointer-events-none absolute inset-0 z-1 bg-linear-to-r to-transparent"
      />

      {/* Oversized sage leaf bled off the corner, drifting against the scroll.
          Decorative, hence aria-hidden. Sage rather than pine: at this scale a
          pine silhouette reads as a stain on the linen. */}
      <Drift
        depth="far"
        anchor="top"
        className="pointer-events-none absolute -top-44 -right-48 z-2"
      >
        <IconLeaf
          aria-hidden="true"
          className="size-168 text-green-300 opacity-25"
        />
      </Drift>

      <div className="relative z-10 mx-auto grid w-full max-w-295 items-center gap-14 px-6 pt-32 pb-20 lg:grid-cols-[1.05fr_0.92fr] lg:gap-16 lg:px-10 lg:pt-40 lg:pb-24">
        <div>
          <span
            className="bg-primary-soft text-primary rise inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium"
            style={{ "--rise-delay": "0ms" } as React.CSSProperties}
          >
            <span
              aria-hidden="true"
              className="bg-primary size-1.5 rounded-full"
            />
            {tl("eyebrow")}
          </span>

          <WordReveal
            text={tl("headline")}
            className="display text-primary mt-6 max-w-[17ch] text-[clamp(2.4rem,5.6vw,4.1rem)] leading-[1.05]"
            delayMs={140}
          />

          <p
            className="text-muted rise mt-6 max-w-[54ch] text-[17px] leading-relaxed"
            style={{ "--rise-delay": "620ms" } as React.CSSProperties}
          >
            {tl("subhead")}
          </p>

          <div
            className="rise mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            style={{ "--rise-delay": "720ms" } as React.CSSProperties}
          >
            <ButtonLink href={ROUTES.upload} size="lg">
              {tl("startAnalysis")}
            </ButtonLink>
            <ButtonLink href={ROUTES.signIn} size="lg" variant="outline">
              {tl("signIn")}
            </ButtonLink>
          </div>
        </div>

        {/* Drifts WITH the scroll, slightly — the leaf goes the other way, and
            the opposition between them is what reads as depth. */}
        <Drift depth="near" anchor="top">
          <SpecimenMotion>
            <AnchoredSpecimen />
          </SpecimenMotion>
        </Drift>
      </div>

      {/*
       * Wrapped so the stagger waits for the strip to be on screen. The hero is
       * 92svh, so on most viewports these sit below the fold and their
       * mount-triggered `.rise-stagger` would otherwise finish unseen.
       * `RevealOnView` pauses it via `.await-view` and releases it on entry.
       */}
      <RevealOnView className="relative z-10 mx-auto w-full max-w-295 px-6 lg:px-10">
        <ul
          className="rise-stagger border-border grid gap-8 border-t pt-10 pb-20 sm:grid-cols-3"
          aria-label={tl("eyebrow")}
        >
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <li
                key={pillar.key}
                style={{ "--i": index + 14 } as React.CSSProperties}
              >
                {/*
                 * `view` rather than `mount`: the strip sits below a 92svh
                 * hero, so a mount-triggered draw would finish before anyone
                 * scrolled to it — the same failure `RevealOnView` exists to
                 * fix for the CSS animations beside it. The three glyphs then
                 * keep answering the pointer, each with its own motion, and the
                 * cascade delay matches the `.rise-stagger` cell it lands in.
                 */}
                <IconMotion
                  on={["view", "hover"]}
                  within="li"
                  delay={index * 90}
                >
                  <Icon
                    aria-hidden="true"
                    className="text-primary mb-3 size-5"
                    strokeWidth={1.6}
                  />
                </IconMotion>
                <h2 className="display text-ink text-[15px]">
                  {tl(`pillars.${pillar.key}.title`)}
                </h2>
                <p className="text-muted mt-1.5 text-[13.5px] leading-relaxed">
                  {tl(`pillars.${pillar.key}.body`)}
                </p>
              </li>
            );
          })}
        </ul>
      </RevealOnView>
    </section>
  );
}
