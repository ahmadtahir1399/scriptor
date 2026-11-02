import { getTranslations } from "next-intl/server";

import { RevealOnView } from "@/components/marketing/RevealOnView";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * The questions a student close to submission actually has.
 *
 * ── Every answer here is checkable ────────────────────────────────────────
 * A competitor's FAQ is reassurance. This one states mechanism, and each claim
 * traces to something in the repository:
 *
 *   "no one else can read it"   → RLS is owner-scoped on every table
 *                                 (`15_rls.sql`), not merely hidden in the UI
 *   "not used to train"         → `paper_uploads.share_data` defaults FALSE
 *   "no public link exists"     → both buckets are `public = false` and no
 *                                 public URL is generated anywhere
 *                                 (`16_storage_realtime.sql`)
 *   "purged after 90 days"      → `default_auto_delete` + the retention sweep
 *                                 (`19_retention_cron.sql`)
 *   "PDF or Word, up to 50 MB"  → the bucket's `file_size_limit` is 52428800
 *                                 and `allowed_mime_types` is exactly those two
 *   "ten citation styles"       → the `citation_style` enum has ten members
 *   "a failed extra does not
 *    fail your analysis"        → `analysis_jobs.is_optional`, honoured by
 *                                 `recompute_analysis_status()`
 *   "free right now"            → there is no billing; `upload_entitlements`
 *                                 says so outright
 *
 * Writing it this way costs nothing and means nothing here can quietly become
 * untrue: if the behaviour changes, the sentence is wrong in a way someone can
 * catch.
 *
 * ── Shape ─────────────────────────────────────────────────────────────────
 * Two grouped columns rather than one long stack. A student's questions
 * cluster around two different anxieties — "is my work safe" and "what will it
 * actually do" — and naming those clusters is itself an answer to the first
 * one. It also stops eight rows becoming a wall.
 *
 * A Server Component. `Accordion` is a client primitive, but every prop it
 * takes here is serialisable, so the copy still renders on the server.
 */
export async function Faq() {
  const t = await getTranslations("landing.faq");

  const groups = [
    { key: "data", items: ["a", "b", "c", "d"] },
    { key: "how", items: ["a", "b", "c", "d"] },
  ] as const;

  return (
    <section
      id="faq"
      className="bg-green-050 relative isolate overflow-hidden py-20 lg:py-28"
    >
      <div className="mx-auto w-full max-w-295 px-6 lg:px-10">
        <SectionHeader
          eyebrow={t("eyebrow")}
          headline={t("headline")}
          subhead={t("subhead")}
          variant="left"
          eyebrowStyle="pill"
        />

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-2 lg:gap-14">
          {groups.map((group, index) => (
            <RevealOnView key={group.key} delay={index * 0.08}>
              <h3
                data-reveal="fade"
                className="eyebrow text-primary border-primary/25 border-b pb-3 text-[11px]"
              >
                {t(`groups.${group.key}.label`)}
              </h3>

              {/*
               * `collapsible` so an open question can be closed again. Without
               * it Radix forces one item to stay open forever, which on a
               * two-column layout leaves a permanently ragged pair of columns.
               */}
              <Accordion type="single" collapsible className="mt-1">
                {group.items.map((item) => (
                  <AccordionItem
                    key={item}
                    value={`${group.key}-${item}`}
                    className="border-primary/15"
                  >
                    <AccordionTrigger className="text-ink text-left text-[14px] leading-snug">
                      {t(`groups.${group.key}.items.${item}.q`)}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted text-[13.5px] leading-relaxed">
                      {t(`groups.${group.key}.items.${item}.a`)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </RevealOnView>
          ))}
        </div>
      </div>
    </section>
  );
}
