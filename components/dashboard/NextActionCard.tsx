import * as React from "react";
import { getTranslations } from "next-intl/server";

import { ROUTES } from "@/lib/constants";
import type { NextActionView } from "@/lib/dashboard/presentation";
import { ButtonLink } from "@/components/ui/button-link";
import { IconLeaf } from "@/components/icons";
import { IconArrowRight, IconSprout } from "@/components/icons";
import { IconMotion } from "@/components/motion/IconMotion";

/**
 * The dashboard's answer to "what should I do next?".
 *
 * A pine panel, because this is the one card on the screen that is structure
 * rather than data — it is the app telling you where to go. It uses
 * `.pine-panel`, the same gradient as the sidebar, so the two can never drift.
 *
 * Three states, and they are genuinely different messages:
 *   1. Something to fix   → name the paper and the count, link into the report.
 *   2. Analyses running   → say so. Do NOT recommend a half-written report.
 *   3. All clear          → say that, and offer the next upload.
 *
 * Copy names what the student DOES ("Review 12 findings"), never what the
 * system did ("job DONE"). A server component: nothing here is interactive.
 */
export interface NextActionCardProps {
  action: NextActionView | null;
  runningCount: number;
}

export async function NextActionCard({
  action,
  runningCount,
}: NextActionCardProps) {
  const t = await getTranslations("dashboard.next");

  const body = action
    ? {
        eyebrow: t("eyebrow"),
        title: t("title", { count: action.openIssues }),
        detail: action.title,
        href: action.analysisId
          ? `/analysis/${action.analysisId}`
          : ROUTES.papers,
        cta: t("cta"),
      }
    : runningCount > 0
      ? {
          eyebrow: t("runningEyebrow"),
          title: t("runningTitle", { count: runningCount }),
          detail: t("runningDetail"),
          href: ROUTES.papers,
          cta: t("runningCta"),
        }
      : {
          eyebrow: t("clearEyebrow"),
          title: t("clearTitle"),
          detail: t("clearDetail"),
          href: ROUTES.upload,
          cta: t("clearCta"),
        };

  return (
    /* `h-full` so it fills the stretched grid row and stays level with the
       standing card beside it — without it the pine block ends short and the
       hero row reads as two unrelated cards that failed to line up. */
    <section className="pine-panel text-panel-foreground relative flex h-full min-h-[236px] flex-col justify-between overflow-hidden rounded-lg p-6 lg:p-7">
      {/* The brand mark, oversized into a watermark. Decorative only — at 12%
          it carries no meaning, which is the one role honey is allowed at this
          contrast. Reusing the mark rather than drawing a second botanical
          keeps the identity singular. */}
      {/* `data-dash="watermark"` opts it out of the dashboard's glyph cascade
          and into its own 1.9s draw: at 240px this is a different order of
          size from an 18px icon, and drawn at glyph speed it scribbles itself
          across the panel instead of laying the ground in behind it. */}
      <IconLeaf
        aria-hidden="true"
        data-dash="watermark"
        className="text-panel-foreground pointer-events-none absolute -top-8 -right-12 size-60 rotate-12 opacity-12"
      />

      <div className="relative">
        <p className="eyebrow text-panel-muted flex items-center gap-2">
          {/* Drawn by `DashboardMotion`'s cascade, not by its own wrapper — one
              clock for the whole screen. This one only handles the hover. */}
          <IconMotion within="section">
            <IconSprout aria-hidden="true" className="size-3.5" />
          </IconMotion>
          {body.eyebrow}
        </p>

        <h2 className="display mt-3 max-w-[20ch] text-[30px] leading-[1.12]">
          {body.title}
        </h2>

        <p className="text-body text-panel-muted mt-3 line-clamp-2 max-w-[36ch]">
          {body.detail}
        </p>
      </div>

      <div className="relative mt-6">
        <ButtonLink href={body.href} variant="onPanel" size="lg">
          {body.cta}
          {/* The arrow leans the way you are about to go. Listening on the
              link, not the 16px glyph, so the whole button carries it. */}
          <IconMotion within="[data-slot=button-link]">
            <IconArrowRight aria-hidden="true" />
          </IconMotion>
        </ButtonLink>
      </div>
    </section>
  );
}
