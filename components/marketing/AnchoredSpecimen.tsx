import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

/**
 * The hero's product surface: one sentence of a thesis, with a finding pinned
 * to the exact words that caused it.
 *
 * This is the page's thesis statement rendered as an object. Every competitor
 * shows a dashboard screenshot; the thing Scriptor does that they cannot is
 * resolve a finding down to a span of text — `words` stores a bounding box per
 * word so `findings.word_index_start/end` can be drawn over the real PDF. So
 * the hero shows that, not a chart.
 *
 * It also demonstrates the three-face type system in a single object, which is
 * why all three appear here and nowhere else together:
 *   Fraunces     (.display)       — our voice, the finding's title
 *   Inter        (default)        — the interface around it
 *   Source Serif (.prose-thesis)  — the student's own sentence
 *
 * Still a Server Component. `data-motion` attributes are the only concession
 * to animation: `SpecimenMotion` selects them from the client and drives the
 * timeline. The markup here is the FINISHED state, so with JavaScript off, or
 * under reduced motion, the card simply renders complete.
 *
 * The content is illustrative, not a real user's work — composed rather than
 * captured, so it stays sharp at any density, themes, and translates.
 */
export async function AnchoredSpecimen({ className }: { className?: string }) {
  const t = await getTranslations("landing.specimen");

  return (
    <figure
      data-motion="card"
      className={cn(
        "bg-surface border-border shadow-card rounded-lg border",
        className,
      )}
    >
      {/* Provenance strip — where in the document this came from. */}
      <div
        data-motion="strip"
        className="border-border flex items-center gap-2.5 border-b px-5 py-3"
      >
        <span className="text-muted text-[12.5px] tabular-nums">
          {t("page")}
        </span>
        <span aria-hidden="true" className="bg-border h-3 w-px" />
        <span className="text-muted text-[12.5px]">{t("check")}</span>
        {/*
         * Severity is a soft pill WITH its label, never colour alone — the
         * status foregrounds sit ~1.2:1 from each other and are not meant to
         * be told apart by hue.
         */}
        <span
          data-motion="pill"
          className="bg-critical-soft text-critical ml-auto rounded-full px-2.5 py-1 text-[11.5px] font-medium"
        >
          {t("severity")}
        </span>
      </div>

      {/* The student's sentence. Source Serif, and the highlight is the honey
          wash that `--color-highlight` exists for. */}
      <blockquote className="relative overflow-hidden px-5 pt-5 pb-4">
        {/* The reading pass. A soft sage band rather than a hard rule — this
            is meant to read as attention moving over the text, not as a
            scanner bed. Decorative, so it is hidden from assistive tech. */}
        <span
          data-motion="scan"
          aria-hidden="true"
          className="from-verified/0 via-verified/16 to-verified/0 pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b opacity-0"
        />

        <p className="prose-thesis text-ink relative text-[16.5px] leading-[1.75]">
          {t("quoteBefore")}
          {/* `<mark>` keeps the semantics; the wash is a layer inside it so it
              can wipe in from the left without the element's own background
              appearing all at once. */}
          <mark className="text-ink relative inline-block bg-transparent">
            <span
              data-motion="highlight"
              aria-hidden="true"
              className="bg-highlight absolute inset-x-0 inset-y-[-0.1em] origin-left rounded-[3px]"
            />
            <span className="relative">{t("quoteHighlight")}</span>
          </mark>
          {t("quoteAfter")}
        </p>
      </blockquote>

      {/* The finding. Solid `critical` only as a thin left accent, sitting
          beside the labelled pill above — never as a fill. The rule is its own
          element so it can draw downward instead of appearing all at once. */}
      <div data-motion="finding" className="relative mx-5 mb-5 pl-4">
        <span
          data-motion="rule"
          aria-hidden="true"
          className="bg-critical absolute inset-y-0 left-0 w-0.5 origin-top rounded-full"
        />
        <h3 className="display text-ink text-[15px] leading-snug">
          {t("findingTitle")}
        </h3>
        <p className="text-muted mt-1.5 text-[13.5px] leading-relaxed">
          {t("findingBody")}
        </p>
      </div>

      <figcaption
        data-motion="caption"
        className="border-border text-muted border-t px-5 py-3 text-[12.5px] leading-relaxed"
      >
        {t("caption")}
      </figcaption>
    </figure>
  );
}
