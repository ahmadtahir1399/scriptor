"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import {
  playGesture,
  type GestureRun,
  type IconGesture,
} from "@/lib/motion/iconGestures";

/**
 * Makes an icon respond.
 *
 * ── The client boundary is HERE, and only here ───────────────────────────
 * Same shape as `DrawOnMount`, for the same reason: anime.js is a browser
 * library, so anything importing it is a Client Component. Both exports below
 * take already-rendered SVG and animate the DOM underneath it, which means the
 * icons stay plain server-rendered SVG and a page that uses them stays a
 * Server Component.
 *
 * ── The thing a pointer enters is never the icon ─────────────────────────
 * It is the nav row, the card, the button. So both exports separate the HOST
 * (the subtree searched for glyphs) from the LISTENER (the element whose
 * hover and focus drive the gesture). A `group-hover` class cannot do this
 * job: CSS can only hand off to a CSS animation, and these gestures are stroke
 * draws.
 *
 * Focus is wired alongside hover deliberately. A keyboard user tabbing through
 * the sidebar should see what a mouse user sees, and `focusin` — which bubbles,
 * unlike `focus` — is what makes that true when the focused node is a
 * descendant of the listener.
 *
 * ── Which of the two to use ─────────────────────────────────────────────
 *   · `useIconMotion()` when you are already in a Client Component and can put
 *     a ref on the interactive element. It adds NO DOM, which matters more
 *     than it sounds: `SidebarMenuButton` sizes its icon with `[&>svg]` and
 *     hides its label with `[&>span]:hidden` when the rail collapses, so a
 *     wrapper span inside it would both unsize the glyph and vanish it.
 *   · `<IconMotion>` when the call site is a Server Component and a hook is
 *     not available. It wraps, so check what the parent's child selectors do.
 *
 * ── Reduced motion ──────────────────────────────────────────────────────
 * Nothing is played and no listener is attached — the icon is simply what it
 * was drawn as. There is no "shorter version" of a stroke draw worth having;
 * the children are already the finished artwork.
 *
 * ── Relationship to `DrawOnMount` ───────────────────────────────────────
 * `DrawOnMount` draws whatever is inside it, once, with one config. This picks
 * a gesture PER GLYPH from `data-icon` and can replay it on demand. Where a
 * panel wants "everything in here draws in together", `DrawOnMount` is still
 * the right tool.
 */

export type IconMotionTrigger =
  /** Plays when the pointer enters, or focus moves into, the listener. */
  | "hover"
  /** Plays once, on mount. */
  | "mount"
  /** Plays once, when the glyph first scrolls into view. */
  | "view"
  /** Never plays on its own — driven by `play()` or `playKey`. */
  | "manual";

export interface IconMotionOptions {
  /**
   * Overrides the glyph's declared motion.
   *
   * Usually wrong to set. The point of the registry is that a bell rings
   * everywhere it appears; reach for this only when a particular placement
   * means something other than the glyph's usual job. Note that `on: "mount"`
   * already resolves to `draw` on its own — see `play()`.
   */
  gesture?: IconGesture;
  /**
   * What starts it. Default `hover`.
   *
   * Several are allowed: `["view", "hover"]` draws the glyph in as its section
   * arrives and then answers the pointer for the rest of the page's life. They
   * do not fight — an arrival animates stroke dashes and a response animates
   * transforms, so even an overlap composes.
   */
  on?: IconMotionTrigger | readonly IconMotionTrigger[];
  /**
   * Selector for an ANCESTOR to listen on, passed to `closest()`. Without it
   * the host element listens for itself — which is what you want when the ref
   * is already on the nav row or the button.
   */
  within?: string;
  /** ms before the gesture starts. */
  delay?: number;
  /**
   * Replays whenever this value CHANGES — for when the value IS the event.
   *
   * Never on first render: a gesture that plays because a value already had a
   * value is announcing the page, not the news. When the trigger is an event
   * rather than a value, use `play()` instead — the notification bell rings
   * when the unread count goes *up*, which no single value changing expresses.
   */
  playKey?: string | number;
}

export interface IconMotionControls<T extends Element> {
  /**
   * Goes on the element that contains the glyphs.
   *
   * DESTRUCTURE IT AT THE CALL SITE — `const { ref: rowRef } = useIconMotion()`
   * — and never write `motion.ref` inside the JSX. `react-hooks/refs` reads
   * any `.ref` property access in a render body as reading a ref value, which
   * it rightly forbids, and cannot tell that this one is only being handed
   * onward. Destructuring says the same thing in a shape the rule accepts.
   *
   * It is a callback rather than the ref object so that the object itself
   * never leaves this file.
   */
  ref: React.RefCallback<T>;
  /** Plays the gesture now. A no-op under reduced motion. */
  play: () => void;
}

export function useIconMotion<T extends Element = HTMLElement>({
  gesture,
  on = "hover",
  within,
  delay = 0,
  playKey,
}: IconMotionOptions = {}): IconMotionControls<T> {
  const host = React.useRef<T | null>(null);
  const run = React.useRef<GestureRun | null>(null);
  const reduced = useReducedMotion();

  /* An inline `on={["view", "hover"]}` is a fresh array every render, which
     would re-run the effects below — and re-firing a once-only trigger on
     every render is the one thing they must not do. Collapsing to a string
     first gives a dependency that changes only when the triggers do. */
  const onKey = Array.isArray(on) ? [...on].sort().join(" ") : (on as string);
  const triggers = React.useMemo(
    () => new Set(onKey.split(" ") as IconMotionTrigger[]),
    [onKey],
  );

  /**
   * Plays the gesture.
   *
   * An ARRIVAL always draws, whatever the glyph is; a RESPONSE plays the
   * glyph's own motion. Every arrival in this app is a draw — the gauge, the
   * chart line, `DrawOnMount`, the headline — and the per-glyph character (the
   * ring, the flip, the bloom) is what the icon spends on being answered. A
   * bell that swung as it arrived would be reacting to nothing.
   *
   * An explicit `gesture` overrides both.
   */
  const start = React.useCallback(
    (fallback?: IconGesture) => {
      if (reduced) return;
      const root = host.current;
      if (!root) return;

      /* Re-entering before the last gesture finished restarts it rather than
         layering a second set of tweens over the same paths. */
      run.current?.stop();
      run.current = playGesture(root, { gesture: gesture ?? fallback, delay });
    },
    [reduced, gesture, delay],
  );

  const play = React.useCallback(() => start(), [start]);

  React.useEffect(() => {
    if (reduced || !triggers.has("hover")) return;

    const root = host.current;
    if (!root) return;

    /* A missing `within` match is not an error — it means the host is not (or
       is not yet) inside the element the caller expected, and listening on the
       host itself is a sane thing to do instead of nothing. */
    const listener = (within ? root.closest(within) : root) ?? root;

    const onEnter = () => start();
    listener.addEventListener("pointerenter", onEnter);
    listener.addEventListener("focusin", onEnter);

    return () => {
      listener.removeEventListener("pointerenter", onEnter);
      listener.removeEventListener("focusin", onEnter);
    };
  }, [reduced, triggers, within, start]);

  React.useEffect(() => {
    if (triggers.has("mount")) start("draw");
  }, [triggers, start]);

  React.useEffect(() => {
    if (reduced || !triggers.has("view")) return;

    const root = host.current;
    if (!root) return;

    /*
     * The GLYPH is observed, not the host. A host with `display: contents`
     * generates no box, and an element with no box never reports as
     * intersecting — so observing the wrapper would mean the gesture silently
     * never fires. The svg is a real box, and "is the icon on screen" is the
     * question being asked anyway.
     */
    const glyph = root.querySelector("svg[data-icon]");
    if (!glyph) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        /* Once. Redrawing every time a section is scrolled back past turns a
           flourish into a tic. */
        observer.disconnect();
        start("draw");
      },
      /* Matches `RevealOnView`'s "top 88%" — the glyph should be moving by the
         time it is properly in view, not start the instant it appears. */
      { threshold: 0.4, rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(glyph);
    return () => observer.disconnect();
  }, [reduced, triggers, start]);

  /* Seeded with the first value so the initial render is not a change. A ref
     write is not a state update, so this stays clear of the effect rules that
     (rightly) reject `setState` in an effect. */
  const lastKey = React.useRef(playKey);
  React.useEffect(() => {
    if (playKey === undefined || lastKey.current === playKey) return;
    lastKey.current = playKey;
    play();
  }, [playKey, play]);

  React.useEffect(() => () => run.current?.stop(), []);

  const setHost = React.useCallback((node: T | null) => {
    host.current = node;
  }, []);

  return { ref: setHost, play };
}

/** What a `ref` on `<IconMotion>` gets you. */
export interface IconMotionHandle {
  /** Plays the gesture now. A no-op under reduced motion. */
  play: () => void;
}

export interface IconMotionProps extends IconMotionOptions {
  children: React.ReactNode;
  /** Imperative control, for when the caller decides. */
  ref?: React.Ref<IconMotionHandle>;
  className?: string;
}

/**
 * Whether the wrapper has to generate a box.
 *
 * Only hover does, and only when there is no `within` ancestor to hand the
 * listening to. `view` looks after itself by observing the glyph rather than
 * the wrapper.
 */
function hostNeedsBox(
  on: IconMotionProps["on"],
  within: string | undefined,
): boolean {
  if (within) return false;
  const triggers = Array.isArray(on) ? on : [on ?? "hover"];
  return triggers.includes("hover");
}

export function IconMotion({
  children,
  ref,
  className,
  ...options
}: IconMotionProps) {
  const { ref: host, play } = useIconMotion<HTMLSpanElement>(options);

  React.useImperativeHandle(ref, () => ({ play }), [play]);

  return (
    <span
      ref={host}
      className={cn(
        /*
         * A pointer listener needs a box to receive the pointer, so a hover
         * wrapper with no `within` to delegate to becomes `inline-flex`. Every
         * other case stays `display: contents` and changes no layout at all —
         * which is what lets this be dropped around an icon without disturbing
         * the flex row it sits in.
         *
         * `contents` removes the BOX, not the node: a parent's `> svg`
         * selector still will not reach through this span, which is why the
         * hook exists for call sites that can hold a ref.
         */
        hostNeedsBox(options.on, options.within) ? "inline-flex" : "contents",
        className,
      )}
    >
      {children}
    </span>
  );
}
