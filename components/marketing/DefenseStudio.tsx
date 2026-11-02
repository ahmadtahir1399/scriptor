import { getTranslations } from "next-intl/server";

import { RevealOnView } from "@/components/marketing/RevealOnView";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import {
  DefenseDemo,
  type DemoAttempt,
} from "@/components/marketing/DefenseDemo";

/**
 * The hero's third pillar: ready for the viva.
 *
 * `defense_questions` are generated from the thesis itself — each carries a
 * `source_quote` and `page_number`, so a question is always traceable to the
 * passage that provoked it. But the section is NOT built on that: two sections
 * already show "select a thing, see where it came from", and a third would
 * make the page read as one screen restyled three ways.
 *
 * It is built on the time axis instead, which nothing else here has.
 * `defense_practices` is a session and `defense_question_answers` is keyed by
 * (practice, question), so one question accumulates an answer per session.
 * `11_defense.sql` says why that shape exists: "the same question across
 * sessions shows progress."
 *
 * So the section shows one question and three attempts at it, and you can move
 * between them. The answer visibly improves — vague restatement, then a named
 * mechanism, then a mechanism with a direction and a cost to the claim. That
 * progression is the product's actual promise, and it cannot be shown in a
 * feature grid.
 *
 * Header is centre + pill, the sixth distinct opening.
 */
export async function DefenseStudio() {
  const t = await getTranslations("landing.defense");

  const scores = [48, 71, 88] as const;
  const attempts: DemoAttempt[] = (["a", "b", "c"] as const).map(
    (key, index) => ({
      id: key,
      label: t(`attempts.${key}.label`),
      date: t(`attempts.${key}.date`),
      score: scores[index] ?? 0,
      answer: t(`attempts.${key}.answer`),
      feedback: t(`attempts.${key}.feedback`),
    }),
  );

  return (
    <section
      id="defense"
      className="bg-green-050 relative isolate overflow-hidden py-20 lg:py-28"
    >
      <div className="mx-auto w-full max-w-295 px-6 lg:px-10">
        <SectionHeader
          eyebrow={t("eyebrow")}
          headline={t("headline")}
          subhead={t("subhead")}
          variant="center"
          eyebrowStyle="pill"
        />

        {/* Narrower than the two-document panels on purpose. This is one
            question and one answer — giving it 1360px of width would leave the
            prose stranded in a field of empty card. */}
        <RevealOnView className="mx-auto mt-12 max-w-[62rem] lg:mt-16">
          <DefenseDemo
            question={t("question")}
            difficulty={t("difficulty")}
            sourceLabel={t("sourceLabel")}
            answerLabel={t("answerLabel")}
            scoreLabel={t("scoreLabel")}
            attemptsLabel={t("attemptsLabel")}
            attempts={attempts}
          />
        </RevealOnView>
      </div>
    </section>
  );
}
