import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/button-link";
import { IconLeaf } from "@/components/icons";
import { IconMotion } from "@/components/motion/IconMotion";
import { ScrollProgress } from "@/components/marketing/ScrollProgress";

/**
 * A floating capsule that fills in as the page is read.
 *
 * Not a full-width bar pinned to the top edge, which is what every competitor
 * ships. It is detached on all four sides so the linen ground runs behind it,
 * and the almond fill sweeping left to right is bound to scroll position via
 * `--read`.
 *
 * The fill is the header's whole idea: the product's claim is that it reads a
 * document end to end, so the chrome does the same thing to this page in front
 * of you. It is a progress indicator that happens to also be the argument.
 *
 * `scaleX` rather than `width` — width would relayout the capsule's contents
 * on every frame; a transform composites and touches nothing else. The fill
 * carries `aria-hidden` because scroll position is already conveyed by the
 * scrollbar, and a second announcement of it is noise.
 */
export async function MarketingNav() {
  const [t, tn] = await Promise.all([
    getTranslations("common"),
    getTranslations("landing.nav"),
  ]);

  return (
    <ScrollProgress className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-4">
      <header className="mx-auto w-full max-w-265">
        <nav
          aria-label={tn("primary")}
          className="border-border bg-surface/80 shadow-card relative flex items-center overflow-hidden rounded-full border py-2 pr-2 pl-4 backdrop-blur-xl sm:pl-5"
        >
          <span
            aria-hidden="true"
            /* Sage rather than almond. This bar is the only chrome on screen
               at every scroll position, so it is the cheapest place to keep the
               brand colour present without adding a single new element.
               `muted` on green-100 is 5.04:1 and `primary` 9.49:1 — both still
               clear AA once the fill is under the nav's own type. */
            className="bg-green-100/60 pointer-events-none absolute inset-0 origin-left"
            style={{ transform: "scaleX(var(--read))" }}
          />

          <div className="relative flex w-full items-center gap-5">
            <Link
              href={ROUTES.home}
              className="focus-visible:ring-primary flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:outline-none"
            >
              {/*
               * Hover only, and deliberately not `mount`. The capsule is on
               * screen at the same moment the hero headline reveals itself and
               * the specimen drifts in — a third thing moving up there does
               * not add richness, it splits the attention the headline was
               * built to hold.
               */}
              <IconMotion within="a">
                <IconLeaf className="text-primary size-5.5" />
              </IconMotion>
              <span className="display text-primary text-[18px] leading-none">
                {t("appName")}
              </span>
            </Link>

            {/*
             * The section links grow a pine rule from the left on hover.
             *
             * `after:` on the anchor rather than a border: a border would
             * occupy layout and nudge the capsule's baseline by a pixel the
             * moment it appeared. `origin-left` and `scale-x-0` mean the rule
             * WIPES rather than fades — the same left-to-right reading motion
             * the capsule's own fill makes, at a twelfth the size.
             */}
            <div className="ml-auto hidden items-center gap-6 md:flex">
              <a
                href="#checks"
                className="text-muted hover:text-primary focus-visible:ring-primary ease-out-quiet after:bg-primary relative rounded-sm text-[14px] transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 focus-visible:ring-2 focus-visible:outline-none"
              >
                {tn("checks")}
              </a>
              <a
                href="#anchored"
                className="text-muted hover:text-primary focus-visible:ring-primary ease-out-quiet after:bg-primary relative rounded-sm text-[14px] transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:transition-transform after:duration-200 after:content-[''] hover:after:scale-x-100 focus-visible:ring-2 focus-visible:outline-none"
              >
                {tn("howItWorks")}
              </a>
            </div>

            <div className="ml-auto flex items-center gap-1.5 md:ml-0">
              <ButtonLink
                href={ROUTES.signIn}
                size="sm"
                variant="ghost"
                className="text-ink hover:text-primary hidden rounded-full sm:inline-flex"
              >
                {tn("signIn")}
              </ButtonLink>
              <ButtonLink
                href={ROUTES.upload}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-full border-none shadow-none"
              >
                {tn("start")}
              </ButtonLink>
            </div>
          </div>
        </nav>
      </header>
    </ScrollProgress>
  );
}
