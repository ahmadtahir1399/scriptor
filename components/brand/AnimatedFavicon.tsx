"use client";

import * as React from "react";

import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/**
 * The favicon reads the leaf, the way the product reads a thesis.
 *
 * Honey rises through the blade over ~1.8s, holds, drains, and repeats. This is
 * the same `--read` idea the marketing nav capsule uses — the chrome performing
 * the claim the product makes — shrunk to 32px. A generic spinner would be the
 * same mechanic making no argument.
 *
 * WHY CANVAS RATHER THAN AN ANIMATED FILE. An animated SVG favicon does not
 * animate in Chrome, and an animated GIF favicon stopped animating there years
 * ago; APNG works only in Firefox. Repainting a canvas and swapping the link's
 * `href` is the one approach that behaves the same in every current browser.
 *
 * COLOURS COME FROM THE LIVE TOKENS. A canvas cannot reference a Tailwind
 * class, so this reads `--color-panel`, `--color-panel-muted` and
 * `--color-decor` off the document at run time. That keeps `globals.css` the
 * single source the design system requires, and it makes the favicon
 * theme-aware for free: `.dark` redefines `--color-panel`, and the observer
 * below repaints when `next-themes` toggles the class.
 *
 * `--color-panel` rather than `--color-primary` is deliberate and is the rule
 * in `globals.css`: primary INVERTS to sage in dark mode, which would turn the
 * tab icon into a pale slab. The panel tokens stay a pine panel in both themes.
 *
 * COST. One 32px PNG encode per frame at 15fps, and only while the tab is
 * visible — `visibilitychange` stops the loop, because a background tab is
 * throttled to roughly 1fps and a stuttering favicon is worse than a still one.
 * Under `prefers-reduced-motion` the component never touches the head at all
 * and `app/icon.svg` is left in place.
 */

/** Raster size. 32 is the largest size any current browser draws the tab at. */
const SIZE = 32;
/** The icon set's coordinate grid — see `components/icons/Icon.tsx`. */
const GRID = 24;
/** ~15fps. Below this the rise visibly steps; above it, the encode is wasted. */
const FRAME_MS = 66;

/** Phase lengths, in ms. */
const RISE = 1800;
const HOLD = 500;
const DRAIN = 700;
const REST = 400;
const CYCLE = RISE + HOLD + DRAIN + REST;

/** `IconLeaf`, verbatim. Blade is a closed path, so it can be filled. */
const BLADE =
  "M20 3.6c0 8.4-4.8 13.4-11.6 14C5 17.9 3 15.2 3 11.9 3 7 7.5 3.6 13.7 3.6H20Z";
const MIDRIB = "M18.9 4.7C13.7 8.4 9.9 12.9 7.4 21";

/** Blade extent on the grid, for the fill's travel. */
const BLADE_TOP = 3.6;
const BLADE_BOTTOM = 17.9;

/**
 * Centres the mark on the grid with a margin the tab strip needs — a glyph run
 * edge to edge reads as a smudge at 16px.
 */
const MARK_SCALE = 0.86;
const MARK_X = 2.11;
const MARK_Y = 1.42;

interface Palette {
  panel: string;
  blade: string;
  read: string;
}

/**
 * Fallbacks are the light-theme token values. They are only reachable if the
 * stylesheet has not applied when the first frame draws; every later frame uses
 * whatever `globals.css` currently defines.
 */
function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    panel: token("--color-panel", "#22392c"),
    blade: token("--color-panel-muted", "#a8bfae"),
    read: token("--color-decor", "#be9b5b"),
  };
}

/** 0 → 1 → 0 across one cycle, eased at both ends. */
function readAt(elapsed: number): number {
  const t = elapsed % CYCLE;
  const ease = (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  if (t < RISE) return ease(t / RISE);
  if (t < RISE + HOLD) return 1;
  if (t < RISE + HOLD + DRAIN) return 1 - ease((t - RISE - HOLD) / DRAIN);
  return 0;
}

function draw(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  read: number,
): void {
  const unit = SIZE / GRID;

  ctx.clearRect(0, 0, SIZE, SIZE);

  ctx.beginPath();
  ctx.roundRect(0, 0, SIZE, SIZE, SIZE * 0.23);
  ctx.fillStyle = palette.panel;
  ctx.fill();

  ctx.save();
  ctx.translate(MARK_X * unit, MARK_Y * unit);
  ctx.scale(MARK_SCALE * unit, MARK_SCALE * unit);

  const blade = new Path2D(BLADE);
  ctx.fillStyle = palette.blade;
  ctx.fill(blade);

  if (read > 0) {
    // Clipped to the blade so the honey takes the leaf's own shape rather than
    // reading as a bar laid over it.
    ctx.save();
    ctx.clip(blade);
    const height = (BLADE_BOTTOM - BLADE_TOP) * read;
    ctx.fillStyle = palette.read;
    ctx.fillRect(0, BLADE_BOTTOM - height, GRID, height);
    ctx.restore();
  }

  // Drawn last, so the midrib stays legible through the fill — it is the stroke
  // that makes the glyph a leaf rather than a blob at 16px.
  ctx.strokeStyle = palette.panel;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(MIDRIB));

  ctx.restore();
}

export function AnimatedFavicon() {
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (reduced) return;

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    // `roundRect` is the only recent API used; without it the ground would be a
    // square, so bail to the static SVG rather than ship a different icon.
    if (!ctx || typeof ctx.roundRect !== "function") return;

    /*
     * Every icon link is pointed at the current frame, and none is ever
     * removed.
     *
     * The `app/icon.svg` link is rendered by Next's metadata, which means React
     * owns that node. Removing a node React still has in its tree is how you
     * get "NotFoundError: The node to be removed is not a child of this node"
     * on some later render — and the render it breaks is a navigation. Setting
     * `href` is an attribute write on a node that stays exactly where React put
     * it, so the worst case is React overwriting us, which the observer below
     * simply re-applies.
     *
     * Writing to ALL of them also sidesteps the question of which link the
     * browser prefers when there is more than one: they agree.
     */
    const icons = () => [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
    ];

    const original = icons().map((node) => ({
      node,
      href: node.getAttribute("href"),
      type: node.getAttribute("type"),
    }));

    // Next emits no icon link at all if `app/icon.svg` is ever removed, so own
    // one unconditionally rather than depend on its presence.
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    document.head.appendChild(link);

    let frame = "";
    const apply = () => {
      for (const node of icons()) {
        if (node.getAttribute("href") !== frame) {
          node.setAttribute("href", frame);
          node.setAttribute("type", "image/png");
        }
      }
    };

    // Next re-emits its metadata links on client navigations, which resets the
    // href back to the static SVG mid-animation.
    const headGuard = new MutationObserver(apply);
    headGuard.observe(document.head, {
      childList: true,
      subtree: true,
      attributeFilter: ["href"],
    });

    let palette = readPalette();
    const start = performance.now();
    let timer: number | undefined;

    const paint = (read: number) => {
      draw(ctx, palette, read);
      frame = canvas.toDataURL("image/png");
      apply();
    };

    const tick = () => paint(readAt(performance.now() - start));

    const run = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(tick, FRAME_MS);
      tick();
    };

    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };

    // A hidden tab is throttled to about 1fps, which turns the rise into a
    // stutter. Park it on the resting frame instead — that is the frame the
    // static SVG draws, so the icon does not appear to change when you leave.
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        paint(0);
      } else {
        run();
      }
    };

    // `next-themes` toggles a class on <html>; the panel tokens differ per
    // theme, so the palette has to be re-read rather than captured once.
    const observer = new MutationObserver(() => {
      palette = readPalette();
      tick();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) run();
    else paint(0);

    return () => {
      stop();
      observer.disconnect();
      // Before the restore below, or the guard would re-apply the last frame
      // over the values being put back.
      headGuard.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      // Only our own node is removed; React's are handed back their attributes.
      link.remove();
      for (const entry of original) {
        if (entry.href !== null) entry.node.setAttribute("href", entry.href);
        if (entry.type !== null) entry.node.setAttribute("type", entry.type);
        else entry.node.removeAttribute("type");
      }
    };
  }, [reduced]);

  return null;
}
