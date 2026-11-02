import { getTranslations } from "next-intl/server";

import { RevealOnView } from "@/components/marketing/RevealOnView";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import {
  ViewerDemo,
  type DemoFinding,
  type DemoTone,
} from "@/components/marketing/ViewerDemo";

/**
 * The wedge: a finding is not a note about your thesis, it is attached to the
 * words that caused it.
 *
 * This is the one claim PaperCheck structurally cannot make. `words` stores a
 * bounding box per token — ~50,000 rows for a thesis — and `findings` carries
 * `word_index_start/end`, so a finding resolves to a span of text and the
 * viewer draws over it. Every competitor shows a dashboard; this shows the
 * page, and lets you use it.
 *
 * ── Why a working mock of the real viewer ─────────────────────────────────
 * The section IS the product's own screen — toolbar, rail, page, findings
 * sidebar — with its real interaction: select a finding, see where it lands.
 * A visitor who signs up meets something they have already operated. Inventing
 * a prettier diagram here would be inventing a notation nobody encounters
 * again.
 *
 * ── The split ─────────────────────────────────────────────────────────────
 * This stays a Server Component and owns the copy; `ViewerDemo` is the client
 * island and owns the state. Strings arrive as props rather than the island
 * calling `useTranslations` itself, so the message catalogue is resolved on
 * the server and never enters the bundle.
 */
export async function AnchoredViewer() {
  const t = await getTranslations("landing.anchored");

  const tones: readonly DemoTone[] = ["grammar", "content", "ai"];
  const findings: DemoFinding[] = (["a", "b", "c"] as const).map(
    (key, index) => ({
      id: key,
      tone: tones[index] ?? "content",
      type: t(`findings.${key}.type`),
      quote: t(`findings.${key}.quote`),
      note: t(`findings.${key}.note`),
      before: t(`viewer.p${index + 1}a`),
      mark: t(`viewer.mark${index + 1}`),
      after: t(`viewer.p${index + 1}b`),
    }),
  );

  return (
    <section
      id="anchored"
      className="bg-green-050 relative isolate overflow-hidden py-24 lg:py-36"
    >
      {/*
       * Centred, and the only section that is. This is the argument's pivot —
       * the claim no competitor can make — so it opens as a statement rather
       * than as another scannable left-aligned block.
       */}
      <div className="mx-auto w-full max-w-295 px-6 lg:px-10">
        <SectionHeader
          eyebrow={t("eyebrow")}
          headline={t("headline")}
          subhead={t("subhead")}
          variant="center"
          eyebrowStyle="rule"
        />
      </div>

      {/*
       * The panel breaks WIDER than the text column above it — 1360 against
       * 1180. Every other section on the page is one column of one width, so
       * the step outward is the thing that stops this reading as another card
       * in a stack. It is also simply a better shape for a three-pane viewer.
       */}
      <div className="mx-auto w-full max-w-340 px-6 lg:px-10">
        {/* One `RevealOnView` for the whole panel: it is a single object
            arriving, and per-part triggers would make it assemble itself in
            pieces on screen. */}
        <RevealOnView className="mt-12 lg:mt-16">
          <ViewerDemo
            page={t("viewer.page")}
            zoom={t("viewer.zoom")}
            findingCount={t("viewer.findingCount")}
            sidebar={t("viewer.sidebar")}
            heading={t("viewer.heading")}
            hint={t("viewer.hint")}
            findings={findings}
          />
        </RevealOnView>
      </div>

      <div className="mx-auto w-full max-w-295 px-6 lg:px-10">
        {/*
         * Three facts about the mechanism, not marketing numbers. ~50,000 is
         * the real per-thesis row count `words` is documented with in
         * `supabase/migrations/06_pages.sql`, and 8 is the member count of the
         * `page_type` enum. Nothing here is a claim about customers, which is
         * why it can be stated at all.
         */}
        <ol className="mt-10 grid gap-4 sm:grid-cols-3 lg:mt-12 lg:gap-5">
          {(["a", "b", "c"] as const).map((key, index) => (
            <RevealOnView
              as="li"
              key={key}
              delay={index * 0.07}
              className="border-border relative border-t pt-5"
            >
              <p
                data-reveal="fade"
                className="display text-primary text-[22px] leading-none tabular-nums"
              >
                {t(`facts.${key}.value`)}
              </p>
              <p
                data-reveal="fade"
                className="text-muted mt-2.5 text-[13px] leading-relaxed"
              >
                {t(`facts.${key}.body`)}
              </p>
            </RevealOnView>
          ))}
        </ol>
      </div>
    </section>
  );
}
