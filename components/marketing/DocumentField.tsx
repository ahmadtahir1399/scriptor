"use client";

import * as React from "react";

import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/**
 * A thesis being read, live, behind the hero.
 *
 * Real prose, set in the student's own serif — not abstract bars. The first
 * revision of this drew rectangles standing in for words, and at low contrast
 * a grid of grey bars reads as a skeleton loader, which is precisely the wrong
 * association for a hero. Actual sentences read as a document immediately.
 *
 * The passage is the paper the specimen card is quoting, and it contains that
 * exact sentence. So the card is a detail lifted out of the page behind it, and
 * a finding occasionally lands on the same phrase in both places.
 *
 * The reading wave is the product's claim rendered literally: attention moving
 * through a document end to end, findings attaching to phrases it has passed.
 *
 * ── Why canvas, and why two of them ──────────────────────────────────────
 * ~600 words of text. Re-issuing 600 `fillText` calls every frame costs several
 * milliseconds; text rasterisation is far more expensive than `fillRect`. So the
 * full page is drawn ONCE into an offscreen canvas at rest alpha, and each frame
 * blits that single bitmap and then re-draws only the ~80 words currently inside
 * the wave band. Frame cost becomes independent of document length.
 */

interface Word {
  text: string;
  x: number;
  y: number;
  w: number;
  line: number;
}

interface Finding {
  from: number;
  to: number;
  born: number;
}

interface Palette {
  rest: string;
  lit: string;
  highlight: string;
  critical: string;
}

const FONT_SIZE = 12.5;
const LINE_HEIGHT = 23;
const PARAGRAPH_GAP = 12;
const SPACE = 4;
const WAVE_PERIOD = 13;
const WAVE_BAND = 165;
const FINDING_INTERVAL = 1700;
const FINDING_LIFE = 4600;
const REST_ALPHA = 0.17;

/**
 * The paper. Deliberately real academic prose rather than lorem: at this size
 * the shape of actual sentences — clause length, citation-free stretches, the
 * turn at "Yet" — is what makes it scan as a thesis instead of as filler.
 */
const PASSAGE = [
  "Recent scholarship on distributed labour has converged on a broadly optimistic account of autonomy. Where earlier studies treated physical co-presence as a precondition for effective coordination, the post-pandemic literature has largely abandoned that assumption without examining it.",
  "The results demonstrate that flexible scheduling raises output in every industry, regardless of sector or firm size. This claim recurs, in near-identical phrasing, across a substantial portion of the reviewed corpus.",
  "Yet the evidence base is narrower than the consensus suggests. Of the fourteen longitudinal studies reviewed here, eleven draw exclusively on knowledge-sector firms with fewer than two hundred employees, and none follow participants beyond a single fiscal year.",
  "The measures are uneven as well. Self-reported productivity, task completion counts and manager assessment are treated as interchangeable proxies, despite a well-documented divergence between them under precisely the conditions these studies examine.",
  "This chapter argues that the apparent consensus is an artefact of sampling rather than a finding about work. Establishing that requires separating the three claims the literature routinely collapses into one.",
];

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const get = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;

  return {
    rest: get("--color-muted", "#635c51"),
    lit: get("--color-primary", "#22392c"),
    highlight: get("--color-highlight", "#f6e4b8"),
    critical: get("--color-critical", "#94553f"),
  };
}

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function DocumentField({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const probeRef = React.useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const probe = probeRef.current;
    if (!canvas || !probe) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let words: Word[] = [];
    let palette = readPalette(canvas);
    let findings: Finding[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    let lastFinding = 0;
    let visible = true;
    let start = 0;
    let font = `${FONT_SIZE}px Georgia, serif`;
    let base: HTMLCanvasElement | null = null;
    let dpr = 1;
    let cancelled = false;

    const random = mulberry32(0xa11ce);

    /**
     * next/font generates a hashed family name, so `"Source Serif 4"` would not
     * resolve on a canvas. Reading the computed family off a probe carrying
     * `.prose-thesis` gets the real name — and keeps the field bound to whatever
     * that class uses rather than to a string that can silently drift.
     */
    function resolveFont() {
      const family = getComputedStyle(probe!).fontFamily;
      if (family) font = `${FONT_SIZE}px ${family}`;
    }

    function layout() {
      const measure = document.createElement("canvas").getContext("2d");
      if (!measure) return;
      measure.font = font;

      const next: Word[] = [];
      let y = LINE_HEIGHT * 1.4;
      let line = 0;
      let paragraph = 0;

      while (y < height + LINE_HEIGHT) {
        const text = PASSAGE[paragraph % PASSAGE.length];
        if (!text) break;

        let x = paragraph === 0 ? 0 : 26;

        for (const token of text.split(" ")) {
          const w = measure.measureText(token).width;
          if (x + w > width) {
            x = 0;
            y += LINE_HEIGHT;
            line += 1;
            if (y > height + LINE_HEIGHT) break;
          }
          next.push({ text: token, x, y, w, line });
          x += w + SPACE;
        }

        y += LINE_HEIGHT + PARAGRAPH_GAP;
        line += 1;
        paragraph += 1;
      }

      words = next;
      findings = [];
      drawBase();
    }

    /** The whole page, rasterised once at rest alpha. */
    function drawBase() {
      if (width === 0 || height === 0) return;
      base = document.createElement("canvas");
      base.width = Math.floor(width * dpr);
      base.height = Math.floor(height * dpr);
      const bctx = base.getContext("2d");
      if (!bctx) return;

      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.font = font;
      bctx.textBaseline = "alphabetic";
      bctx.fillStyle = palette.rest;
      bctx.globalAlpha = REST_ALPHA;
      for (const word of words) bctx.fillText(word.text, word.x, word.y);
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
    }

    function spawnFinding(now: number) {
      if (words.length === 0) return;
      const anchor = Math.floor(random() * words.length);
      const anchorWord = words[anchor];
      if (!anchorWord) return;

      const from = anchor;
      let to = anchor;
      const run = 1 + Math.floor(random() * 3);
      while (
        to + 1 < words.length &&
        words[to + 1]?.line === anchorWord.line &&
        to - from < run
      ) {
        to += 1;
      }
      findings.push({ from, to, born: now });
    }

    function draw(now: number) {
      if (cancelled) return;
      if (!start) start = now;
      const elapsed = (now - start) / 1000;

      ctx!.clearRect(0, 0, width, height);

      if (base) {
        ctx!.globalAlpha = 1;
        ctx!.drawImage(base, 0, 0, width, height);
      }

      const waveY = reduced
        ? height * 0.4
        : ((elapsed % WAVE_PERIOD) / WAVE_PERIOD) * (height + WAVE_BAND * 2) -
          WAVE_BAND;

      // Findings first, so their wash sits behind the words.
      for (const finding of findings) {
        const age = now - finding.born;
        const grow = Math.min(1, age / 400);
        const fade =
          age > FINDING_LIFE - 800
            ? Math.max(0, 1 - (age - (FINDING_LIFE - 800)) / 800)
            : 1;

        const first = words[finding.from];
        const last = words[finding.to];
        if (!first || !last) continue;

        const w = last.x + last.w - first.x;

        ctx!.globalAlpha = 0.8 * fade;
        ctx!.fillStyle = palette.highlight;
        ctx!.fillRect(
          first.x - 2,
          first.y - FONT_SIZE + 1,
          w * grow + 4,
          FONT_SIZE + 6,
        );

        if (grow >= 1) {
          ctx!.globalAlpha = 0.85 * fade;
          ctx!.fillStyle = palette.critical;
          ctx!.fillRect(first.x - 10, first.y - FONT_SIZE, 2, FONT_SIZE + 5);
        }
      }

      // Only the words the wave is currently over are re-rendered.
      ctx!.font = font;
      ctx!.textBaseline = "alphabetic";
      ctx!.fillStyle = palette.lit;
      for (const word of words) {
        const distance = Math.abs(word.y - waveY);
        if (distance > WAVE_BAND) continue;
        const intensity = Math.cos((distance / WAVE_BAND) * Math.PI * 0.5) ** 2;
        ctx!.globalAlpha = intensity * 0.78;
        ctx!.fillText(word.text, word.x, word.y);
      }

      // Words under an active finding stay legible after the wave has gone.
      ctx!.fillStyle = palette.lit;
      for (const finding of findings) {
        const age = now - finding.born;
        const fade =
          age > FINDING_LIFE - 800
            ? Math.max(0, 1 - (age - (FINDING_LIFE - 800)) / 800)
            : Math.min(1, age / 400);
        ctx!.globalAlpha = 0.8 * fade;
        for (let i = finding.from; i <= finding.to; i += 1) {
          const word = words[i];
          if (word) ctx!.fillText(word.text, word.x, word.y);
        }
      }

      ctx!.globalAlpha = 1;

      if (reduced) return;

      if (now - lastFinding > FINDING_INTERVAL) {
        lastFinding = now;
        spawnFinding(now);
      }
      findings = findings.filter((f) => now - f.born < FINDING_LIFE);

      raf = requestAnimationFrame(draw);
    }

    function restart() {
      cancelAnimationFrame(raf);
      start = 0;
      raf = requestAnimationFrame(draw);
    }

    resolveFont();
    resize();
    raf = requestAnimationFrame(draw);

    // The first layout runs against the fallback serif; once the real face is
    // ready every measurement has changed, so it has to be redone.
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      resolveFont();
      layout();
      restart();
    });

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduced) restart();
    });
    resizeObserver.observe(canvas);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting === visible) return;
        visible = entry.isIntersecting;
        if (visible && !reduced) restart();
        else cancelAnimationFrame(raf);
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (visible && !reduced) restart();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const themeObserver = new MutationObserver(() => {
      palette = readPalette(canvas);
      drawBase();
      if (reduced) restart();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return (
    <>
      {/* Font probe. Carries `.prose-thesis` so the canvas inherits whatever
          face the student's writing actually uses. */}
      <span
        ref={probeRef}
        aria-hidden="true"
        className="prose-thesis pointer-events-none absolute size-0 opacity-0"
      />
      <canvas ref={canvasRef} aria-hidden="true" className={className} />
    </>
  );
}
