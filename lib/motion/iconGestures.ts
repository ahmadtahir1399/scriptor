import { animate, stagger, type JSAnimation } from "animejs";
import { createDrawable } from "animejs/svg";

import type { IconGlyph } from "@/components/icons/Icon";

/**
 * How the icon set moves.
 *
 * ── Why a registry and not an animation per call site ────────────────────
 * There are fifty-two glyphs and they appear on every screen. If motion were
 * authored where each icon is used, the bell in the topbar and the bell in an
 * empty state would drift apart within a week, and "the icons feel alive"
 * would decay into "some icons do something". A glyph's motion is a property
 * of the DRAWING, the same way its stroke weight is — so it is declared once,
 * beside the drawing's name, and every call site gets the same answer.
 *
 * ── Nine gestures, not fifty-two animations ─────────────────────────────
 * The set is deliberately small. A vocabulary of nine reads as one hand; a
 * bespoke animation per glyph reads as a demo. Direction is DATA rather than a
 * tenth and eleventh name: a chevron-down is `lift` with `dir: -1`, which is
 * the same motion pointed the other way, and naming it `drop` would imply it
 * was a different idea.
 *
 * ── What each gesture is allowed to touch ───────────────────────────────
 * Only three things, all of which the icon set already declares:
 *   · `[data-draw]`   — every stroke, normalised to `pathLength={1}`.
 *   · `[data-accent]` — the one stroke that carries the meaning, if any.
 *   · `[data-seed]`   — the filled signature dot, if any.
 * Nothing here measures a path or reaches for a glyph by name, so a new icon
 * is animated correctly the moment it is drawn and tagged.
 *
 * ── Reduced motion ──────────────────────────────────────────────────────
 * Not handled here. `IconMotion` is the only caller and it never plays a
 * gesture when the preference is set — the icon simply is what it is. That is
 * the right split: this module knows about motion, not about whether to move.
 */

/* ── Eases and durations ──────────────────────────────────────────────────
 *
 * The two curves are the JS transcription of `--ease-draw` and `--ease-settle`
 * in `app/globals.css`. They are duplicated rather than read off the
 * document because resolving a custom property costs a layout read on every
 * hover — but they must not drift, so change them together.
 */
const EASE_DRAW = "cubicBezier(0.22, 1, 0.36, 1)";
const EASE_SETTLE = "cubicBezier(0.34, 1.28, 0.48, 1)";
/** Symmetric in and out — for a full rotation, where an out-ease reads lopsided. */
const EASE_TURN = "cubicBezier(0.65, 0, 0.35, 1)";
/** A swing decays; it should not overshoot on top of decaying. */
const EASE_SWING = "outQuad";

/*
 * Hover motion is faster than the page's entrance motion on purpose. An
 * entrance is an arrival and can take `--duration-rise`; a hover is a
 * RESPONSE, and a response that outlasts the pointer reads as lag.
 */
const DUR_DRAW = 620;
const DUR_TRACE = 540;
const DUR_MOVE = 520;
const DUR_TURN = 760;
const DUR_SWING = 900;
const DUR_POP = 500;

export type IconGesture =
  /** Retrace every stroke, seeds landing after. The set's house motion. */
  | "draw"
  /** Retrace the accent alone — "this one stroke is the message". */
  | "trace"
  /** A pendulum swing from the crown. The bell, and only the bell. */
  | "ring"
  /** Slide along X and return. Anything that points somewhere. */
  | "nudge"
  /** Slide along Y and return. Anything that goes up or comes down. */
  | "lift"
  /** A full rotation. Anything cyclical. */
  | "turn"
  /** Open a little and settle back — rotation plus a breath of scale. */
  | "bloom"
  /** Pop the seeds in sequence. Anything whose point is a mark, not a shape. */
  | "pulse"
  /** A page turning, in perspective. Anything made of sheets. */
  | "flip";

/** A gesture plus the direction it runs in. `dir` is +1 unless stated. */
export interface GestureSpec {
  gesture: IconGesture;
  dir: 1 | -1;
}

/**
 * Every glyph's motion.
 *
 * `Record<IconGlyph, …>` is load-bearing: adding a glyph to the union without
 * deciding how it moves is a type error, which is the only reliable way to
 * stop the set from quietly growing a silent half.
 */
const GLYPH_GESTURE: Record<IconGlyph, IconGesture | [IconGesture, 1 | -1]> = {
  /* Brand. The leaf opens; it is the one mark allowed to feel botanical. */
  leaf: "bloom",

  /* Navigation. */
  dashboard: "draw",
  library: "flip",
  upload: "lift",
  requirements: "trace",
  settings: "bloom",

  /* Status and feedback. */
  score: "trace",
  findings: "pulse",
  drafts: "flip",
  trend: "trace",
  sprout: "lift",
  alert: "pulse",
  activity: "draw",
  flask: "bloom",
  users: "draw",

  /* Controls. A chevron moves the way it points — that is the whole reason
     `dir` exists. */
  check: "trace",
  close: "draw",
  "arrow-right": "nudge",
  "chevron-down": ["lift", -1],
  "chevron-up": "lift",
  "chevron-left": ["nudge", -1],
  "chevron-up-down": "pulse",
  search: "bloom",
  menu: "draw",
  panel: "flip",
  bell: "ring",
  user: "bloom",
  "sign-out": "nudge",
  spinner: "turn",

  /* Actions. */
  plus: "pulse",
  minus: "pulse",
  refresh: "turn",
  pencil: "nudge",
  /* The lid is the accent, and `lift` moves it after the body — so the bin
     opens rather than the whole glyph hopping. */
  trash: "lift",
  download: ["lift", -1],
  link: "pulse",
  send: "nudge",
  play: "nudge",
  skip: "nudge",
  more: "pulse",

  /* Signals. */
  ai: "pulse",
  info: "pulse",
  "check-circle": "trace",
  "file-question": "pulse",
  idea: "bloom",
  inbox: ["lift", -1],
  "mail-check": "trace",
  mic: "lift",
  "thumb-up": "lift",
  "thumb-down": ["lift", -1],
  graduation: "bloom",
  history: ["turn", -1],
  clock: "trace",
};

/** The fallback for an untagged or unknown glyph — the set's house motion. */
const DEFAULT_SPEC: GestureSpec = { gesture: "draw", dir: 1 };

/**
 * The motion for a glyph name, as read off `data-icon`.
 *
 * Takes a loose string because the caller got it from the DOM, where the type
 * is gone. An unrecognised value is not an error — it means someone rendered
 * an SVG we do not own, and drawing it is a reasonable thing to do to any SVG.
 */
export function gestureForGlyph(glyph: string | null | undefined): GestureSpec {
  const entry = glyph
    ? GLYPH_GESTURE[glyph as IconGlyph]
    : undefined;

  if (!entry) return DEFAULT_SPEC;
  if (Array.isArray(entry)) return { gesture: entry[0], dir: entry[1] };
  return { gesture: entry, dir: 1 };
}

/* ── Running a gesture ──────────────────────────────────────────────────── */

/** A gesture in flight. Stop it to put the glyph back exactly as drawn. */
export interface GestureRun {
  stop: () => void;
}

/** The parts of one glyph a gesture is allowed to move. */
interface GlyphParts {
  svg: SVGSVGElement;
  strokes: SVGPathElement[];
  accents: SVGPathElement[];
  seeds: SVGElement[];
}

/** Collects the animations and inline styles one play is responsible for. */
interface Stage {
  add: (animation: JSAnimation) => void;
  /** Sets inline styles and remembers how to put them back. */
  style: (el: SVGElement, styles: Record<string, string>) => void;
}

function readParts(svg: SVGSVGElement): GlyphParts {
  return {
    svg,
    strokes: Array.from(svg.querySelectorAll<SVGPathElement>("[data-draw]")),
    accents: Array.from(svg.querySelectorAll<SVGPathElement>("[data-accent]")),
    seeds: Array.from(svg.querySelectorAll<SVGElement>("[data-seed]")),
  };
}

/**
 * The seeds landing.
 *
 * They are never traced — a filled dot has no line to follow — so they arrive
 * at the tail of the strokes instead. That is what makes a seed read as a full
 * stop rather than as one more piece of the drawing.
 */
function landSeeds(parts: GlyphParts, stage: Stage, at: number): void {
  if (parts.seeds.length === 0) return;

  stage.add(
    animate(parts.seeds, {
      opacity: [0, 1],
      scale: [0.4, 1],
      ease: "outBack",
      duration: 340,
      delay: stagger(50, { start: at }),
    }),
  );
}

type GestureBuilder = (
  parts: GlyphParts,
  spec: GestureSpec,
  delay: number,
  stage: Stage,
) => void;

const BUILDERS: Record<IconGesture, GestureBuilder> = {
  draw(parts, _spec, delay, stage) {
    if (parts.strokes.length === 0) return;

    /*
     * `createDrawable` normalises each path to a 0→1 line and drives it
     * through `draw`, handling sub-paths and direction. Our paths already
     * declare `pathLength={1}`, so nothing is measured at runtime — which is
     * what makes this affordable on hover rather than only on mount.
     */
    stage.add(
      animate(createDrawable(parts.strokes), {
        draw: ["0 0", "0 1"],
        ease: EASE_DRAW,
        duration: DUR_DRAW,
        delay: stagger(55, { start: delay }),
      }),
    );

    landSeeds(parts, stage, delay + DUR_DRAW * 0.5);
  },

  trace(parts, _spec, delay, stage) {
    /*
     * The accent alone, with the rest of the glyph left standing — a tick
     * re-ticking inside its ring, a needle sweeping back onto its gauge.
     * Falling back to every stroke matters: `check` is a single stroke that IS
     * the accent, and marking it would be noise.
     */
    const targets =
      parts.accents.length > 0 ? parts.accents : parts.strokes;
    if (targets.length === 0) return;

    stage.add(
      animate(createDrawable(targets), {
        draw: ["0 0", "0 1"],
        ease: EASE_DRAW,
        duration: DUR_TRACE,
        delay: stagger(70, { start: delay }),
      }),
    );
  },

  ring(parts, _spec, delay, stage) {
    /*
     * A bell pivots where it hangs, not at its middle — 16% down the box puts
     * the pivot in the crown. Amplitudes decay 13 → 10 → 6 → 3 because a
     * swing that returns at full height reads as a wobble, not a ring.
     */
    stage.style(parts.svg, { "transform-origin": "50% 16%" });
    stage.add(
      animate(parts.svg, {
        rotate: [0, -13, 10, -6, 3, 0],
        ease: EASE_SWING,
        duration: DUR_SWING,
        delay,
      }),
    );

    /* The clapper hangs from its own top and lags the body — that lag is the
       difference between a bell ringing and a bell being rotated. */
    if (parts.accents.length > 0) {
      for (const accent of parts.accents) {
        stage.style(accent, { "transform-origin": "center top" });
      }
      stage.add(
        animate(parts.accents, {
          rotate: [0, 11, -8, 5, 0],
          ease: EASE_SWING,
          duration: DUR_SWING,
          delay: delay + 70,
        }),
      );
    }
  },

  nudge(parts, spec, delay, stage) {
    stage.add(
      animate(parts.svg, {
        translateX: [0, 3 * spec.dir, 0],
        ease: EASE_SETTLE,
        duration: DUR_MOVE,
        delay,
      }),
    );

    /* The arrowhead travels a little further than its shaft, so the glyph
       stretches into the move instead of sliding as a rigid block. Two user
       units on a 24 grid — a fraction of a screen pixel at 20px, which is the
       intended weight. */
    if (parts.accents.length > 0) {
      stage.add(
        animate(parts.accents, {
          translateX: [0, 2 * spec.dir, 0],
          ease: EASE_SETTLE,
          duration: DUR_MOVE + 60,
          delay: delay + 50,
        }),
      );
    }
  },

  lift(parts, spec, delay, stage) {
    /* `dir: 1` means up, and up is negative on both the screen and the grid. */
    const travel = -3 * spec.dir;

    stage.add(
      animate(parts.svg, {
        translateY: [0, travel, 0],
        ease: EASE_SETTLE,
        duration: DUR_MOVE + 40,
        delay,
      }),
    );

    if (parts.accents.length > 0) {
      stage.add(
        animate(parts.accents, {
          translateY: [0, travel * 0.7, 0],
          ease: EASE_SETTLE,
          duration: DUR_MOVE + 100,
          delay: delay + 60,
        }),
      );
    }
  },

  turn(parts, spec, delay, stage) {
    stage.add(
      animate(parts.svg, {
        rotate: [0, 360 * spec.dir],
        ease: EASE_TURN,
        duration: DUR_TURN,
        delay,
      }),
    );
  },

  bloom(parts, spec, delay, stage) {
    stage.add(
      animate(parts.svg, {
        rotate: [0, 15 * spec.dir, 0],
        scale: [1, 1.07, 1],
        ease: EASE_SETTLE,
        duration: 700,
        delay,
      }),
    );

    /* The centre closes as the glyph opens. On the settings bloom that reads
       as an aperture; on the leaf there is no accent and nothing happens. */
    if (parts.accents.length > 0) {
      stage.add(
        animate(parts.accents, {
          scale: [1, 0.84, 1],
          ease: EASE_SETTLE,
          duration: 700,
          delay: delay + 40,
        }),
      );
    }
  },

  pulse(parts, _spec, delay, stage) {
    /*
     * Seeds first, then the accent, then the glyph itself. The amplitude drops
     * as the target grows — a dot can afford a third of its size, a whole
     * glyph cannot, and using one number for both is how a pulse turns into a
     * throb.
     */
    const dots = parts.seeds.length > 0 ? parts.seeds : parts.accents;
    const targets: SVGElement[] = dots.length > 0 ? dots : [parts.svg];
    const peak = dots.length > 0 ? 1.34 : 1.09;

    stage.add(
      animate(targets, {
        scale: [1, peak, 1],
        ease: "outBack",
        duration: DUR_POP,
        delay: stagger(70, { start: delay }),
      }),
    );
  },

  flip(parts, spec, delay, stage) {
    /*
     * `perspective` is given identical from and to values on purpose. anime
     * composes the transform from its own property list, and without a `from`
     * it would read the computed value — which is none — and tween out of
     * `perspective(0px)`, i.e. a degenerate first frame. Pinning both ends
     * makes it a constant term in the transform rather than something being
     * animated.
     */
    stage.add(
      animate(parts.svg, {
        perspective: [240, 240],
        rotateY: [0, -32 * spec.dir, 0],
        ease: EASE_SETTLE,
        duration: 700,
        delay,
      }),
    );
  },
};

export interface PlayGestureOptions {
  /** Overrides the glyph's declared motion. Rarely needed. */
  gesture?: IconGesture;
  /** ms before the first glyph starts. */
  delay?: number;
}

/**
 * Cap on the cascade when one wrapper holds several icons.
 *
 * Same reasoning as `DrawOnMount.maxStagger`: a per-icon delay multiplied by
 * icon count means the last glyph waits while showing nothing, which reads as
 * a missing icon rather than an imminent one.
 */
const MAX_CASCADE = 240;

/**
 * Play the right gesture on every glyph inside `host`.
 *
 * Selects `svg[data-icon]`, so it animates icons from our set and leaves any
 * other SVG in the subtree alone. Several glyphs under one host cascade rather
 * than firing together — a button's label icon and its chevron should read as
 * one gesture with a sequence, not as two things twitching at once.
 */
export function playGesture(
  host: Element,
  { gesture, delay = 0 }: PlayGestureOptions = {},
): GestureRun {
  const glyphs = Array.from(
    host.querySelectorAll<SVGSVGElement>("svg[data-icon]"),
  );
  if (glyphs.length === 0) return { stop: () => {} };

  const animations: JSAnimation[] = [];
  const restores: (() => void)[] = [];

  const stage: Stage = {
    add: (animation) => animations.push(animation),
    style: (el, styles) => {
      const previous = Object.keys(styles).map(
        (name) => [name, el.style.getPropertyValue(name)] as const,
      );
      for (const [name, value] of Object.entries(styles)) {
        el.style.setProperty(name, value);
      }
      restores.push(() => {
        for (const [name, value] of previous) {
          if (value) el.style.setProperty(name, value);
          else el.style.removeProperty(name);
        }
      });
    },
  };

  glyphs.forEach((svg, index) => {
    const spec = gesture
      ? { gesture, dir: gestureForGlyph(svg.dataset.icon).dir }
      : gestureForGlyph(svg.dataset.icon);

    BUILDERS[spec.gesture](
      readParts(svg),
      spec,
      delay + Math.min(index * 70, MAX_CASCADE),
      stage,
    );
  });

  return {
    stop: () => {
      /* `revert` puts every tweened value back to what it was before the
         animation touched it, which for a drawable means the dash properties
         come off entirely and the glyph is once again exactly as authored. */
      for (const animation of animations) animation.revert();
      for (const restore of restores) restore();
    },
  };
}
