import * as React from "react";
import { useTranslations } from "next-intl";

import { scoreTone, type ScoreTone } from "@/lib/analysis/presentation";

/**
 * The score arc — the one signature gauge in the product.
 *
 * Exactly one per report, with nothing competing beside it. It is the whole
 * reason the palette has a sage-to-honey range.
 *
 * ── All motion is CSS ─────────────────────────────────────────────────────
 * This used to drive framer-motion: `useMotionValue`, `useTransform`, an
 * `animate()` call and two effects, one of which called `setState`
 * synchronously. All of it is gone. The arc draws via `.arc-draw`
 * (stroke-dashoffset between two inline custom properties), the end-cap rides
 * the arc via `.arc-sweep`, and the number counts up via `.count-up`
 * (`@property` + `counter()`). No hooks, no state, no re-renders.
 *
 * The component therefore needs no client JavaScript of its own. It does not
 * get to claim zero-JS in practice, because `AnalysisReport` above it is a
 * client component that owns the realtime subscription, so this is bundled
 * with it. `useTranslations` (not `getTranslations`) keeps it renderable from
 * either side, so it costs nothing if that ever changes.
 *
 * Every animation writes its FINAL value as the static declaration and uses
 * the keyframe only for the `from`. So under `prefers-reduced-motion`, where
 * `globals.css` removes these animations outright rather than clamping them,
 * the gauge renders complete and correct — never blank, never showing 0. A
 * clamped 0.01ms draw still paints one frame of an empty arc, which is why
 * clamping alone is not enough.
 *
 * ── Accessibility ─────────────────────────────────────────────────────────
 * `.count-up` renders its digits through `::after`, which screen readers do
 * not reliably announce, so the true value is also emitted in an `sr-only`
 * span and the decorative copy is `aria-hidden`.
 */
export interface ScoreArcProps {
  score: number | null;
  settled: boolean;
  /** Outer diameter in px. The number and label scale with it. */
  size?: number;
  /**
   * Show the "Academic score" eyebrow inside the ring.
   *
   * Off wherever the surrounding card already names the metric — the
   * dashboard's standing card does, and repeating it inside the ring both
   * duplicates the label and crowds the only place the number has to breathe.
   */
  showLabel?: boolean;
}

/**
 * Band colours. This is the design system's "thin accent beside a label" case:
 * the arc is a stroke, the number and the SCORE eyebrow sit inside it, so the
 * colour reinforces a value that is already legible and never carries the
 * meaning alone. See the semantic contract in `globals.css`.
 */
const TONE_STROKE: Record<ScoreTone, string> = {
  critical: "var(--color-critical)",
  warning: "var(--color-decor)",
  verified: "var(--color-verified)",
  muted: "var(--color-green-400)",
};

const DEFAULT_SIZE = 148;
const STROKE = 9;

export function ScoreArc({
  score,
  settled,
  size = DEFAULT_SIZE,
  showLabel = true,
}: ScoreArcProps) {
  const t = useTranslations("analysis.score");

  const RADIUS = (size - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  /*
   * The ring's usable interior, minus a margin on each side. The eyebrow used
   * to be unconstrained and "ACADEMIC SCORE" is wider than a 148px ring can
   * hold — it ran straight into the stroke on both sides. Clamping the text
   * box to the chord means the label can never touch the arc at any size.
   */
  const innerWidth = size - STROKE * 2 - 20;
  const valueSize = Math.round(size * 0.284);

  const filled = settled && score !== null;
  const value = filled ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const fill = value / 100;
  const tone = scoreTone(settled ? score : null);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track — almond, the same well tone used everywhere else. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-primary-soft)"
          strokeWidth={STROKE}
        />

        {filled ? (
          <>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={RADIUS}
              fill="none"
              stroke={TONE_STROKE[tone]}
              strokeWidth={STROKE}
              strokeLinecap="round"
              className="arc-draw"
              style={
                {
                  "--dash": CIRCUMFERENCE,
                  "--fill": fill,
                } as React.CSSProperties
              }
            />
            {/*
             * The end-cap dot. Authored at the arc's start and rotated into
             * place — far more robust than animating cx/cy along a path, since
             * `offset-path` support is still uneven and this is two lines.
             */}
            <circle
              cx={size / 2 + RADIUS}
              cy={size / 2}
              r={STROKE / 2 + 1.5}
              fill="var(--color-surface)"
              stroke={TONE_STROKE[tone]}
              strokeWidth={2}
              className="arc-sweep"
              style={
                {
                  "--angle": `${fill * 360}deg`,
                  "--origin": `${size / 2}px ${size / 2}px`,
                } as React.CSSProperties
              }
            />
          </>
        ) : (
          // Generating: a calm sage sweep, not a spinner.
          <circle
            cx={size / 2}
            cy={size / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-green-300)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE * 0.22} ${CIRCUMFERENCE}`}
            className="origin-center animate-spin [animation-duration:2.2s]"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {filled ? (
          <>
            <span
              aria-hidden="true"
              className="display count-up text-ink leading-none tabular-nums"
              style={
                {
                  "--count-to": value,
                  fontSize: valueSize,
                } as React.CSSProperties
              }
            />
            <span className="sr-only">{value}</span>
          </>
        ) : (
          <span
            aria-hidden="true"
            className="display text-muted leading-none"
            style={{ fontSize: valueSize }}
          >
            —
          </span>
        )}

        {showLabel ? (
          <span
            /*
             * `text-muted` in BOTH states. The unfilled label used to step
             * down to `text-muted-soft`, which `globals.css` permits "only
             * when you can see the card it sits on" — and this arc no longer
             * only sits on a plain card. On the report hero's almond gradient
             * muted-soft measures 4.21:1, an AA failure, where muted is
             * 5.62:1. The nuance of a quieter label with no score is not
             * worth a contrast floor that depends on the caller.
             */
            className="eyebrow text-muted mt-1.5 text-center leading-tight text-balance"
            /*
             * Clamped to the ring's interior chord, and stepped down from the
             * global `.eyebrow` (11px/0.14em) which renders "Academic score"
             * at ~110px — wider than a 148px ring can hold, which is why it
             * was running into the stroke on both sides. 10px/0.1em brings it
             * to ~94px so it clears the arc on one line at the default size.
             */
            style={{
              maxWidth: innerWidth,
              fontSize: 10,
              letterSpacing: "0.1em",
            }}
          >
            {t("label")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
