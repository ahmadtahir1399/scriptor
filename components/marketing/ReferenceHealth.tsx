import { getTranslations } from "next-intl/server";

import { RevealOnView } from "@/components/marketing/RevealOnView";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import {
  ReferenceDemo,
  type ReferenceCounter,
  type ReferenceRow,
} from "@/components/marketing/ReferenceDemo";

/**
 * Bibliography reconciliation — and the orphans are the whole point.
 *
 * `supabase/migrations/08_references.sql` states the insight better than any
 * marketing line could: "the interesting output is not the two lists, it is
 * the ORPHANS falling out of joining them." `reference_pairs` has BOTH foreign
 * keys nullable precisely so an unmatched side is representable —
 *
 *   in_text set, bibliography null  → cited in the text, missing from the list
 *   in_text null, bibliography set  → listed, never actually cited
 *   both set                        → matched, with a confidence score
 *
 * Every competitor ships "bibliography verification" as a checkbox on a feature
 * grid. The schema does something specific enough to show, so this section
 * shows it: the two failure directions, side by side, in the product's own UI.
 *
 * The panel opens on the ISSUES tab rather than the sources list. A clean list
 * of verified entries is the least interesting thing here.
 *
 * Server Component; `ReferenceDemo` is the client island and owns only tab
 * state. Strings resolve here so the message catalogue never enters the bundle.
 */
export async function ReferenceHealth() {
  const t = await getTranslations("landing.references");

  const counters: ReferenceCounter[] = [
    { label: t("counters.total.label"), value: t("counters.total.value"), tone: "ink" },
    {
      label: t("counters.verified.label"),
      value: t("counters.verified.value"),
      tone: "verified",
    },
    {
      label: t("counters.issues.label"),
      value: t("counters.issues.value"),
      tone: "critical",
    },
    {
      label: t("counters.uncited.label"),
      value: t("counters.uncited.value"),
      tone: "warning",
    },
  ];

  const build = (
    group: "sources" | "issues" | "uncited",
    keys: readonly string[],
    variants: readonly ReferenceRow["variant"][],
  ): ReferenceRow[] =>
    keys.map((key, index) => ({
      id: `${group}-${key}`,
      citation: t(`rows.${group}.${key}.citation`),
      badge: t(`rows.${group}.${key}.badge`),
      variant: variants[index] ?? "outline",
      note: t(`rows.${group}.${key}.note`),
    }));

  return (
    <section
      id="references"
      className="bg-bg relative isolate overflow-hidden py-20 lg:py-28"
    >
      <div className="mx-auto w-full max-w-295 px-6 lg:px-10">
        {/*
         * Split, and the two failure directions sit in the right column rather
         * than in a row under the panel. The headline says "what falls between
         * them"; naming the two ways things fall through is the answer to it,
         * so it belongs beside the question, not three screens later.
         */}
        <SectionHeader
          eyebrow={t("eyebrow")}
          headline={t("headline")}
          subhead={t("subhead")}
          variant="split"
          eyebrowStyle="rule"
          aside={
            <ul className="flex flex-col gap-4">
              {(["missing", "uncited"] as const).map((key) => (
                <li key={key} className="border-primary/25 border-l-2 pl-4">
                  <p
                    data-reveal="fade"
                    className="display text-primary text-[14px] leading-snug"
                  >
                    {t(`directions.${key}.title`)}
                  </p>
                  <p
                    data-reveal="fade"
                    className="text-muted mt-1.5 text-[13px] leading-relaxed"
                  >
                    {t(`directions.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          }
        />

        <RevealOnView className="mt-12 lg:mt-16">
          <ReferenceDemo
            counters={counters}
            tabs={{
              sources: t("tabs.sources"),
              issues: t("tabs.issues"),
              uncited: t("tabs.uncited"),
            }}
            rows={{
              sources: build(
                "sources",
                ["a", "b", "c", "d"],
                ["verified", "verified", "critical", "warning"],
              ),
              issues: build(
                "issues",
                ["a", "b", "c"],
                ["critical", "critical", "warning"],
              ),
              uncited: build("uncited", ["a", "b"], ["warning", "warning"]),
            }}
          />
        </RevealOnView>
      </div>
    </section>
  );
}
