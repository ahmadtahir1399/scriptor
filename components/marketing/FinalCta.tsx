import { getTranslations } from "next-intl/server";

import { ROUTES } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/button-link";
import { Drift } from "@/components/marketing/Drift";
import { RevealOnView } from "@/components/marketing/RevealOnView";
import { WordReveal } from "@/components/marketing/WordReveal";
import { IconLeaf } from "@/components/icons";

/**
 * The close.
 *
 * Two deliberate callbacks to the hero, so the page ends where it started
 * rather than just stopping: the headline uses the same `WordReveal` swing,
 * and the bled sage leaf returns. Nothing else on the page uses either, which
 * is what makes them read as a bookend instead of as house style.
 *
 * ── Not a pine slab ───────────────────────────────────────────────────────
 * The obvious final CTA is a dark brand panel. That was tried on a content
 * section and rejected — green belongs in the type on linen, not in a slab —
 * and the objection holds here too. The weight comes from type scale and the
 * solid pine button instead.
 *
 * ── The three steps are real ──────────────────────────────────────────────
 * They are the first three `job_kind` values the pipeline actually runs —
 * COMPATIBILITY, PARSE, then the checks — in the order it runs them. The
 * numbering is therefore information, not decoration, which is the only
 * justification for numbering anything.
 *
 * Saying what happens next is also the point: the last thing a visitor needs
 * before uploading a year of work is to know that an unusable file is caught
 * in seconds rather than after a long silence.
 */
export async function FinalCta() {
  const t = await getTranslations("landing.cta");
  const tl = await getTranslations("landing");

  const steps = ["compat", "parse", "analysis"] as const;

  return (
    <section className="bg-bg relative isolate overflow-hidden py-24 lg:py-32">
      {/* The hero's leaf, mirrored to the other corner. Decorative. */}
      <Drift
        depth="far"
        className="pointer-events-none absolute -bottom-52 -left-48 -z-10"
      >
        <IconLeaf
          aria-hidden="true"
          className="size-152 text-green-300 opacity-25"
        />
      </Drift>

      <div className="mx-auto w-full max-w-295 px-6 lg:px-10">
        <RevealOnView className="mx-auto max-w-[46ch] text-center">
          <span className="flex items-center justify-center gap-3">
            <span
              data-reveal="wipe"
              aria-hidden="true"
              className="bg-primary h-px w-8 origin-left"
            />
            <span className="eyebrow text-primary text-[11px]">
              {t("eyebrow")}
            </span>
            <span
              data-reveal="wipe"
              aria-hidden="true"
              className="bg-primary h-px w-8 origin-right"
            />
          </span>

          {/* The hero's motion, returning. `RevealOnView` holds it with
              `.await-view` until the section is on screen. */}
          <WordReveal
            as="h2"
            text={t("headline")}
            className="display text-primary mt-6 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.06]"
            delayMs={80}
          />

          <p
            data-reveal="fade"
            className="text-muted mx-auto mt-5 max-w-[52ch] text-[16.5px] leading-relaxed"
          >
            {t("subhead")}
          </p>

          <div
            data-reveal="fade"
            className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          >
            <ButtonLink href={ROUTES.upload} size="lg">
              {tl("startAnalysis")}
            </ButtonLink>
            <ButtonLink href={ROUTES.signIn} size="lg" variant="outline">
              {tl("signIn")}
            </ButtonLink>
          </div>

          <p data-reveal="fade" className="text-muted mt-4 text-[12.5px]">
            {t("note")}
          </p>
        </RevealOnView>

        {/* What happens after the click. Ordered because the pipeline is
            genuinely ordered — each step gates the next. */}
        <ol className="mt-16 grid gap-6 sm:grid-cols-3 lg:mt-20 lg:gap-8">
          {steps.map((step, index) => (
            <RevealOnView
              as="li"
              key={step}
              delay={index * 0.08}
              /*
               * The rule above each step brightens and its number comes up out
               * of 35% as the step is read. Nothing here is clickable, so the
               * hover is not an affordance — it is a reading aid, the same
               * thing a finger under a line does, and it is why the effect is
               * on the number and the rule rather than on a background.
               */
              className="border-primary/20 hover:border-primary/45 ease-out-quiet group relative border-t pt-5 transition-colors duration-200"
            >
              <span
                aria-hidden="true"
                className="display text-primary/35 ease-out-quiet absolute -top-3 right-0 text-[34px] leading-none tabular-nums transition-[color,transform] duration-200 select-none group-hover:-translate-y-0.5 group-hover:text-primary/60"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <p
                data-reveal="fade"
                className="display text-primary pr-10 text-[15px] leading-snug"
              >
                {t(`steps.${step}.title`)}
              </p>
              <p
                data-reveal="fade"
                className="text-muted mt-2 text-[13px] leading-relaxed"
              >
                {t(`steps.${step}.body`)}
              </p>
            </RevealOnView>
          ))}
        </ol>
      </div>
    </section>
  );
}
