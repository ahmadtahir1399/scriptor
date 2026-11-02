import * as React from "react";
import { getTranslations } from "next-intl/server";

import { scoreBand } from "@/lib/analysis/scoring";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreArc } from "@/components/analysis/ScoreArc";

/**
 * Overall standing — the dashboard's signature moment.
 *
 * Reuses `ScoreArc` rather than drawing a second gauge. That is the point of a
 * signature element: one gauge, one meaning, rendered identically on the report
 * and here. A near-identical second arc would read as a different metric and
 * quietly halve the identity.
 *
 * The eyebrow sits on the card, NOT inside the ring — `showLabel={false}`.
 * "Academic score" does not fit inside a 148px ring and was colliding with the
 * stroke on both sides; hoisting it out both fixes that and stops the card
 * naming the same thing twice.
 *
 * The arc is sized up from the report's 148px because this card is wider than
 * the report's column and a small ring floating in it read as dead space.
 */
export interface StandingCardProps {
  score: number | null;
  paperCount: number;
  runningCount: number;
}

/*
 * Sized against the card BESIDE it, not in isolation. At 176 the standing card
 * grew ~100px taller than the pine card, and since the row stretches, that gap
 * opened up inside the pine card between its text and its button. 156 puts the
 * two within a few pixels of each other while still reading as the largest
 * single thing on the page.
 */
const DASHBOARD_ARC_SIZE = 156;

export async function StandingCard({
  score,
  paperCount,
  runningCount,
}: StandingCardProps) {
  const t = await getTranslations("dashboard.standing");
  const band = scoreBand(score);

  const caption =
    score === null
      ? runningCount > 0
        ? t("captionRunning", { count: runningCount })
        : t("captionEmpty")
      : t("caption", { count: paperCount });

  return (
    /*
     * The almond gradient the landing page gives its feature tiles. This is
     * the dashboard's equivalent — the one card carrying the signature gauge —
     * so it earns the same treatment, and the row now reads as pine panel plus
     * warm feature card rather than two flat rectangles.
     */
    <Card className="from-surface to-primary-soft/35 relative h-full overflow-hidden border-transparent bg-linear-to-br">
      <CardContent className="flex h-full flex-col p-6">
        <p className="mb-1">
          <span
            data-dash="chip"
            className="bg-primary-soft text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-medium"
          >
            <span
              aria-hidden="true"
              className="bg-primary size-1.5 rounded-full"
            />
            {t("eyebrow")}
          </span>
        </p>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2 text-center">
          {/*
           * `settled` is what tells the arc to draw a value rather than sweep.
           * A null score with analyses still running is genuinely unsettled, so
           * the arc shows its calm sage sweep instead of a fabricated zero.
           */}
          <ScoreArc
            score={score}
            settled={score !== null}
            size={DASHBOARD_ARC_SIZE}
            showLabel={false}
          />

          <div>
            {band ? (
              /* Pine like every other display heading. All four bands take
                 the same colour, so pine is not being made to encode state —
                 the arc and the caption carry the value. */
              <p className="display text-primary text-[17px] leading-none">
                {t(`band.${band}`)}
              </p>
            ) : null}
            {/* `text-muted`, not `text-muted-soft`. The almond gradient added
                to this card drops muted-soft to 4.21:1 — measured — and
                `globals.css` allows it "only when you can see the card it
                sits on". The card changed, so the lighter grey no longer
                qualifies; muted is 5.62:1 on the same ground. */}
            <p className="text-meta text-muted mx-auto mt-1.5 max-w-[32ch]">
              {caption}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
