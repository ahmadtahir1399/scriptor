import * as React from "react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";
import { Drift } from "@/components/marketing/Drift";
import { RevealOnView } from "@/components/marketing/RevealOnView";
import { IconCheck, IconClose, IconLeaf } from "@/components/icons";

/**
 * The check catalogue — the nine checks every analysis runs, as a bento.
 *
 * ── Why a bento and not a grid of nine equal cards ────────────────────────
 * Nine identical tiles is a list wearing a grid's clothes: nothing is more
 * important than anything else, so there is nowhere to look. Three of the
 * checks here carry a working miniature of what they actually do, and those
 * three get the big tiles. The other six stay compact, which is what makes
 * the big ones read as big.
 *
 * The spans tile EXACTLY at both breakpoints — no `dense` flow papering over
 * a gap, and no orphan cell:
 *
 *      lg, 3 cols              sm, 2 cols
 *      ┌───────┬───┐           ┌───────┐
 *      │  01   │02 │           │  01   │
 *      │       ├───┤           ├───┬───┤
 *      │       │03 │           │02 │03 │
 *      ├───────┼───┤           ├───┴───┤
 *      │  04   │05 │           │  04   │
 *      ├───┬───┼───┤           ├───┬───┤
 *      │06 │07 │08 │           │05 │06 │
 *      ├───┴───┴───┤           ├───┼───┤
 *      │    09     │           │07 │08 │
 *      └───────────┘           ├───┴───┤
 *                              │  09   │
 *                              └───────┘
 *
 * ── The miniatures ────────────────────────────────────────────────────────
 * Each is a different KIND of interface — a list, a passage, a chart — so the
 * section shows three faces of the product rather than the same card three
 * times. Their content is deliberately fresh: the hero already owns the hasty
 * generalisation and `DriftGallery` owns the finding cards, so these use a
 * citation audit, a circular-reasoning passage and a density strip instead.
 *
 * They are specimens, not live components — the real ones are react-query
 * bound and wiring a public page into that would leak the query layer. They
 * borrow the product's own vocabulary (`.prose-thesis`, `bg-highlight`,
 * `<mark>`, tone rules) so they drift only if the tokens do.
 *
 * ── What earlier cuts got wrong ───────────────────────────────────────────
 * Recorded so they are not re-invented: (1) cream cards on an almond wash —
 * the "beige app with green accents" failure `globals.css` names; (2) a
 * `.pine-panel` band carrying a glyph notation with a legend to decode it — a
 * page that asks a visitor to learn a notation has lost them; (3) plain cards
 * with no motion, which fixed both by removing every reason to look.
 *
 * ── Mirrored, not queried ─────────────────────────────────────────────────
 * `CATALOGUE` duplicates the structural columns of the `checks` rows in
 * `supabase/seed.sql`. Deliberately not a Supabase query: this is an anonymous
 * marketing page, and depending on the database means it 500s — or silently
 * renders an empty grid — whenever the database is unreachable. Each entry
 * keeps its `code` so the mirror is greppable against the seed.
 *
 * Server Component. `Drift` and `RevealOnView` are the only client boundaries
 * and they take this markup as children. Every animated element is authored
 * in its FINAL state — the wipes carry their resting transform inline — so
 * JavaScript off, or reduced motion, leaves a complete, correct section.
 */

type ProcessingMode = "ALL_PAGES" | "INDIVIDUAL_PAGES";
type Demo = "citation" | "logical" | "density";

interface CatalogueEntry {
  /** `checks.code`. The join back to `supabase/seed.sql`. */
  code: string;
  /** Key under `landing.catalogue.checks` in `messages/*.json`. */
  key: string;
  /** `checks.processing_mode`. */
  mode: ProcessingMode;
  /** Bento span. Absent means a compact 1×1 tile. */
  span?: string;
  /** Which miniature this tile carries, if any. */
  demo?: Demo;
}

/** In `checks.sort_order`, the order the report itself presents them in. */
const CATALOGUE: readonly CatalogueEntry[] = [
  {
    code: "CITATION_STYLE",
    key: "citationStyle",
    mode: "ALL_PAGES",
    span: "sm:col-span-2 lg:row-span-2",
    demo: "citation",
  },
  { code: "ARGUMENTATION", key: "argumentation", mode: "ALL_PAGES" },
  { code: "COHERENCE", key: "coherence", mode: "ALL_PAGES" },
  {
    code: "LOGICAL_ERRORS",
    key: "logicalErrors",
    mode: "INDIVIDUAL_PAGES",
    span: "sm:col-span-2",
    demo: "logical",
  },
  { code: "COVER_PAGE", key: "coverPage", mode: "ALL_PAGES" },
  { code: "CHAPTER_ORDER", key: "chapterOrder", mode: "ALL_PAGES" },
  { code: "GENDERING", key: "gendering", mode: "INDIVIDUAL_PAGES" },
  { code: "TERMINOLOGY", key: "terminology", mode: "ALL_PAGES" },
  {
    code: "SOURCE_DENSITY",
    key: "sourceDensity",
    mode: "ALL_PAGES",
    span: "sm:col-span-2 lg:col-span-3",
    demo: "density",
  },
];

const MODE_KEY: Record<ProcessingMode, "allPages" | "individualPages"> = {
  ALL_PAGES: "allPages",
  INDIVIDUAL_PAGES: "individualPages",
};

/**
 * Citations per page across a body, 0–1, with the unsupported passages dipping.
 * Fixed rather than random: a specimen that reshuffles every render is a
 * specimen nobody can review, and SSR and hydration would disagree.
 */
const DENSITY = [
  0.55, 0.72, 0.48, 0.81, 0.64, 0.9, 0.42, 0.08, 0.12, 0.66, 0.78, 0.53, 0.87,
  0.61, 0.45, 0.1, 0.07, 0.58, 0.74, 0.83, 0.5, 0.69, 0.36, 0.06, 0.11, 0.62,
  0.79, 0.47, 0.85, 0.57,
] as const;

/** Below this a passage is making claims with no citation behind it. */
const DENSITY_FLOOR = 0.2;

/* ── Miniatures ─────────────────────────────────────────────────────────── */

/** A bibliography audited against the declared style. */
async function CitationDemo() {
  const t = await getTranslations("landing.catalogue.demos.citation");
  const rows = [
    { key: "a", ok: true },
    { key: "b", ok: true },
    { key: "c", ok: false },
  ] as const;

  const matched = rows.filter((row) => row.ok).length;

  return (
    <div className="bg-surface border-border mt-5 rounded-md border p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10.5px] font-medium">
          {t("style")}
        </span>
        <span className="text-muted text-[11px]">{t("caption")}</span>
      </div>

      {/*
       * The tally counts itself up. `.count-up` renders its digits in
       * `::after`, which screen readers do not reliably announce, so the
       * visual copy is `aria-hidden` and the real number ships in an
       * `sr-only` span beside it — the rule `globals.css` sets for every
       * caller. Both numbers are derived from `rows`, never written down, so
       * the tally cannot disagree with the list underneath it.
       */}
      <div className="mb-3 flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="count-up display text-primary text-[26px] leading-none tabular-nums"
          style={{ "--count-to": matched } as React.CSSProperties}
        />
        <span className="sr-only">{matched}</span>
        <span className="text-muted text-[11px]">
          {t("tally", { total: rows.length })}
        </span>
      </div>

      {/* Fills to the share that matched. The resting transform IS the value,
          so `data-reveal="wipe"` only supplies the `from`. */}
      <div className="bg-primary-soft mb-3 h-1 w-full overflow-hidden rounded-full">
        <span
          data-reveal="wipe"
          data-fill={matched / rows.length}
          aria-hidden="true"
          className="bg-verified block h-full w-full origin-left rounded-full"
          style={{ transform: `scaleX(${matched / rows.length})` }}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start gap-2.5">
            <span
              data-reveal="pop"
              aria-hidden="true"
              className={cn(
                "mt-px flex size-4 shrink-0 items-center justify-center rounded-full",
                row.ok ? "bg-verified-soft" : "bg-critical-soft",
              )}
            >
              {row.ok ? (
                <IconCheck className="text-verified size-2.5" strokeWidth={3} />
              ) : (
                <IconClose className="text-critical size-2.5" strokeWidth={3} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-ink text-[11.5px] leading-snug">
                {t(`${row.key}.text`)}
              </p>
              {/* The label always ships with the colour — the dot never
                  carries the verdict on its own. */}
              <p
                className={cn(
                  "mt-0.5 text-[10.5px]",
                  row.ok ? "text-verified" : "text-critical",
                )}
              >
                {t(row.ok ? "ok" : "bad")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A passage with the fallacy highlighted, and the finding under it. */
async function LogicalDemo() {
  const t = await getTranslations("landing.catalogue.demos.logical");

  return (
    <div className="bg-surface border-border mt-5 rounded-md border p-3.5">
      <p className="prose-thesis text-ink text-[12.5px] leading-[1.75]">
        {t("before")}
        <mark className="text-ink relative inline-block bg-transparent">
          {/* The wash is a layer INSIDE `<mark>` so it can wipe from the left
              without the element's own background appearing all at once. */}
          <span
            data-reveal="wipe"
            aria-hidden="true"
            className="bg-highlight absolute inset-x-0 inset-y-[-0.1em] origin-left rounded-[2px]"
          />
          <span className="relative">{t("mark")}</span>
        </mark>
        {t("after")}
      </p>

      <div className="relative mt-3 pl-3">
        <span
          data-reveal="draw"
          aria-hidden="true"
          className="bg-critical absolute inset-y-0 left-0 w-0.5 origin-top rounded-full"
        />
        <p className="text-ink text-[11.5px] leading-snug">{t("note")}</p>
      </div>
    </div>
  );
}

/** Citation density per page, with the unsupported passages called out. */
async function DensityDemo() {
  const t = await getTranslations("landing.catalogue.demos.density");
  const flagged = DENSITY.filter((v) => v < DENSITY_FLOOR).length;

  return (
    <div className="bg-surface border-border mt-5 rounded-md border p-3.5">
      {/*
       * The count is DERIVED from `DENSITY`, so the number, the pill and the
       * red bars in the chart can never disagree. `.count-up` renders its
       * digits in `::after`, invisible to assistive tech, so the visual copy
       * is `aria-hidden` and the real value ships in an `sr-only` span — the
       * rule `globals.css` sets for every caller of this class.
       */}
      <div className="mb-3 flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="count-up display text-critical text-[26px] leading-none tabular-nums"
          style={{ "--count-to": flagged } as React.CSSProperties}
        />
        <span className="sr-only">{flagged}</span>
        {/* The count still selects the plural form; it just is not printed
            again, because the counting numeral beside it already is. */}
        <span className="text-muted text-[11px]">
          {t("flagged", { flagged })}
        </span>
      </div>

      {/*
       * `.bar-draw` rather than `data-reveal`: `wipe` drives scaleX, which
       * would squash a bar sideways instead of growing it, and `draw` pools
       * every draw node in the tile into one staggered tween. This scales out
       * of the baseline, is local to this container, and costs no JavaScript.
       * `--i` takes a fraction so thirty bars land in ~450ms, and
       * `.await-view` still holds the whole strip until the tile arrives.
       */}
      <div
        className="bar-draw flex h-20 items-end gap-[3px]"
        role="img"
        aria-label={t("alt", { flagged })}
      >
        {DENSITY.map((value, index) => {
          const low = value < DENSITY_FLOOR;
          return (
            <span
              key={index}
              aria-hidden="true"
              className={cn(
                "min-w-0 flex-1 rounded-[1.5px]",
                low ? "bg-critical" : "bg-primary/45",
              )}
              /* The height IS the datum and it is the STATIC declaration, so
                 with no JS and under reduced motion the chart is already
                 true — the keyframe only supplies the scale. */
              style={
                {
                  height: `${Math.round(value * 100)}%`,
                  "--i": index * 0.25,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      <p className="text-muted mt-3 text-[11px]">{t("caption")}</p>
    </div>
  );
}

const DEMOS: Record<Demo, () => Promise<React.JSX.Element>> = {
  citation: CitationDemo,
  logical: LogicalDemo,
  density: DensityDemo,
};

/* ── Section ────────────────────────────────────────────────────────────── */

export async function CheckCatalogue() {
  const t = await getTranslations("landing.catalogue");

  return (
    <section
      id="checks"
      className="bg-green-050 relative isolate overflow-hidden py-20 lg:py-28"
    >
      {/* Depth, and a callback to the hero's leaf. Sage rather than pine: at
          this scale a pine silhouette reads as a stain on the linen. The ramp
          inverts, so this is a pale tint in light and a dark one in dark. */}
      <Drift
        depth="far"
        className="pointer-events-none absolute -top-24 -right-52 -z-10"
      >
        <IconLeaf
          aria-hidden="true"
          /* One ramp step darker than before: the section ground moved from
             linen to green-050, and green-200 on green-050 is close enough in
             value that the leaf disappeared entirely. */
          className="size-152 text-green-300 opacity-40"
        />
      </Drift>

      <div className="mx-auto w-full max-w-295 px-6 lg:px-10">
        <RevealOnView className="max-w-[62ch]">
          <span
            data-reveal="pop"
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium"
          >
            <span
              aria-hidden="true"
              className="bg-primary-foreground/60 size-1.5 rounded-full"
            />
            {t("eyebrow")}
          </span>
          <h2
            data-reveal="fade"
            className="display text-primary mt-5 text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.1] text-balance"
          >
            {t("headline")}
          </h2>
          <p
            data-reveal="fade"
            className="text-muted mt-4 text-[16px] leading-relaxed"
          >
            {t("subhead")}
          </p>
        </RevealOnView>

        {/*
         * Ordered because the numbering is real — `checks.sort_order`.
         *
         * Every tile is its OWN `RevealOnView`, rendering the `li` directly.
         * One wrapper around the whole list would fire all nine the moment
         * the grid's top crossed the trigger, and this grid is ~1300px tall —
         * the bottom row would finish animating well before anyone scrolled
         * to it. Per-tile triggers also scope each miniature's own draws,
         * wipes and pops to that tile instead of pooling forty nodes into one
         * staggered timeline. `once: true` inside `RevealOnView` means each
         * plays exactly once and never replays on the way back up.
         */}
        <ol className="mt-12 grid auto-rows-auto gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-5">
          {CATALOGUE.map((entry, index) => {
            const DemoTile = entry.demo ? DEMOS[entry.demo] : null;

            return (
              <RevealOnView
                as="li"
                key={entry.code}
                // Tiles sharing a row enter together; a small offset makes
                // that read as a ripple rather than a single block landing.
                delay={(index % 3) * 0.07}
                className={cn(
                  "bg-surface border-border shadow-card lift hover:border-primary/35 relative flex flex-col overflow-hidden rounded-lg border p-5 pl-6",
                  // A soft almond gradient gives the feature tiles their
                  // own weight without a second card colour.
                  DemoTile && "from-surface to-primary-soft/35 bg-linear-to-br",
                  entry.span,
                )}
              >
                {/* Pine, not a status colour — this is chrome. Draws
                      downward rather than appearing all at once. */}
                <span
                  data-reveal="draw"
                  aria-hidden="true"
                  className="bg-primary absolute inset-y-0 left-0 w-0.5 origin-top"
                />

                {/* An almond watermark. Decorative and `aria-hidden`: the
                      real ordinal is the <ol>. */}
                <span
                  aria-hidden="true"
                  className="display text-primary-soft pointer-events-none absolute top-2.5 right-3.5 text-[40px] leading-none tabular-nums select-none"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <h3 className="display text-primary relative pr-12 text-[16px] leading-snug">
                  {t(`checks.${entry.key}.name`)}
                </h3>

                <p className="text-muted relative mt-2.5 text-[13.5px] leading-relaxed">
                  {t(`checks.${entry.key}.description`)}
                </p>

                {DemoTile ? <DemoTile /> : null}

                {/*
                 * `mt-auto` pins the pill row to the tile's bottom so every
                 * pill in a grid row agrees, whatever the description length
                 * does — German runs long — and whether or not a miniature
                 * sits above it. `pt-5` is the minimum gap for the case
                 * where tall content collapses the auto margin to nothing.
                 */}
                <div className="relative mt-auto pt-5">
                  <span
                    data-reveal="pop"
                    className="bg-primary-soft text-primary inline-block rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                  >
                    {t(`modes.${MODE_KEY[entry.mode]}.label`)}
                  </span>
                </div>
              </RevealOnView>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
