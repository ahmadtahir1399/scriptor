import { getTranslations } from "next-intl/server";

import { RevealOnView } from "@/components/marketing/RevealOnView";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import {
  RequirementsDemo,
  type DemoClause,
  type DemoRule,
} from "@/components/marketing/RequirementsDemo";

/**
 * The hero's second pillar, delivered: your department's criteria, not a
 * generic rubric.
 *
 * Three tables. `requirement_files` is the guide the student uploads;
 * `requirements` is what extraction turns it into — one row per discrete rule,
 * carrying `is_mandatory` and the `source_quote` it came from; and
 * `upload_requirements` grades one upload against each, with `is_satisfied`
 * and an `evidence_quote`.
 *
 * The section shows the MIDDLE step, because that is the only part that is
 * hard. Accepting a file upload is not a feature. Turning hedged handbook
 * prose into rules that are individually gradeable, individually evidenced,
 * and traceable back to the sentence that produced them is a different claim
 * entirely — and it fits in one screen.
 *
 * A clause and the rule it produced share an id, which is what makes the link
 * between the two panels work in both directions.
 *
 * Header uses split with the PILL — the fourth distinct opening on the page.
 */
export async function Requirements() {
  const t = await getTranslations("landing.requirements");

  const keys = ["a", "b", "c", "d", "e", "f"] as const;

  /**
   * `mandatory` follows the handbook's modal verb, not the rule's importance:
   * shall / must / is required to → mandatory; should → advisory. The trigger
   * word ships to the UI so the classification can be checked rather than
   * taken on trust.
   */
  const mandatory: readonly boolean[] = [true, true, true, false, true, false];
  const satisfied: readonly boolean[] = [true, false, false, true, true, true];

  const clauses: DemoClause[] = keys.map((key) => ({
    id: key,
    num: t(`clauses.${key}.num`),
    before: t(`clauses.${key}.before`),
    mark: t(`clauses.${key}.mark`),
    after: t(`clauses.${key}.after`),
  }));

  const rules: DemoRule[] = keys.map((key, index) => ({
    id: key,
    title: t(`rules.${key}.title`),
    trigger: t(`rules.${key}.trigger`),
    evidence: t(`rules.${key}.evidence`),
    mandatory: mandatory[index] ?? true,
    satisfied: satisfied[index] ?? true,
  }));

  return (
    <section
      id="requirements"
      className="bg-bg relative isolate overflow-hidden py-20 lg:py-28"
    >
      <div className="mx-auto w-full max-w-295 px-6 lg:px-10">
        <SectionHeader
          eyebrow={t("eyebrow")}
          headline={t("headline")}
          subhead={t("subhead")}
          variant="split"
          eyebrowStyle="pill"
          aside={
            <ul className="flex flex-col gap-4">
              {(["trace", "modal"] as const).map((key) => (
                <li key={key} className="border-primary/25 border-l-2 pl-4">
                  <p
                    data-reveal="fade"
                    className="display text-primary text-[14px] leading-snug"
                  >
                    {t(`points.${key}.title`)}
                  </p>
                  <p
                    data-reveal="fade"
                    className="text-muted mt-1.5 text-[13px] leading-relaxed"
                  >
                    {t(`points.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          }
        />
      </div>

      {/* Wider than the copy column, like the viewer: this is two documents
          side by side and a 1180px box would crush both of them. */}
      <div className="mx-auto w-full max-w-340 px-6 lg:px-10">
        <RevealOnView className="mt-12 lg:mt-16">
          <RequirementsDemo
            fileName={t("file.name")}
            fileStatus={t("file.status")}
            heading={t("file.heading")}
            rulesLabel={t("file.rulesLabel")}
            labels={{
              required: t("labels.required"),
              recommended: t("labels.recommended"),
              met: t("labels.met"),
              notMet: t("labels.notMet"),
              because: t("labels.because"),
            }}
            clauses={clauses}
            rules={rules}
          />
        </RevealOnView>
      </div>
    </section>
  );
}
