"use client";

import * as React from "react";

import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

/**
 * Plays a card's own animation when the card reaches the viewport.
 *
 * Two jobs, and the second is a bug fix.
 *
 * 1. It animates the wrapper in, then the parts inside it, driven by
 *    `data-reveal` attributes on the server-rendered markup. Each surface
 *    declares how its pieces behave and never imports GSAP itself.
 *
 * 2. It holds the product's mount-triggered CSS animations until the card is
 *    actually visible. `.arc-draw` and `.count-up` in `globals.css` start when
 *    the element mounts — which for anything below the fold means the gauge
 *    finishes drawing and the number finishes counting while it is still off
 *    screen, and the visitor scrolls down to a static arc. `.await-view` pauses
 *    them; reaching the viewport releases them.
 *
 * `.await-view` is added FROM JAVASCRIPT, never in the markup. Shipped in the
 * HTML it would freeze the gauge at frame zero for anyone whose JS fails — the
 * blank-arc failure the reduced-motion rules in `globals.css` exist to prevent.
 * Absent from the server render, the no-JS path just plays on mount as before.
 *
 * The `data-reveal` vocabulary:
 *   fade  — opacity and a short rise. The default for text.
 *   wipe  — scaleX from 0, left origin. Highlights and progress bars; the
 *           target comes from `data-fill`, defaulting to 1.
 *   draw  — scaleY from 0, top origin. Severity rules.
 *   pop   — scale and opacity, with overshoot. Pills and checkboxes.
 */

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function RevealOnView({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  /** Offsets the whole sequence, to stagger cards that enter together. */
  delay?: number;
  /**
   * The element to render.
   *
   * `li` exists so a tile inside an `<ol>`/`<ul>` can be its OWN trigger. The
   * alternative — wrapping each item in this component's `div` — puts an
   * invalid `<ol> > <div>` between the list and its items; the alternative to
   * THAT is one wrapper around the whole list, which makes every item animate
   * the moment the list's top enters, so anything below the fold finishes
   * unseen. Rendering the `li` itself is the only option that keeps both the
   * markup valid and the trigger local to the item.
   */
  as?: "div" | "li";
}>) {
  const ref = React.useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    /*
     * Anything already on screen is left exactly as the server drew it.
     *
     * `gsap.from()` renders its start values IMMEDIATELY — `immediateRender`
     * defaults to true and a paused timeline does not change that. This effect
     * runs at hydration, long after the server HTML has painted, so arming the
     * reveal on a card the visitor is currently looking at blanks it and then
     * fades it back in: a visible blink on load. The ScrollTrigger below would
     * fire `onEnter` on creation anyway, because such a card is already past
     * `start`, so the hidden frame buys nothing.
     *
     * Below the fold this never applied — the card is hidden before it can be
     * seen, which is the whole point. Only the on-screen case is a bug.
     */
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    el.classList.add("await-view");

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, delay });

      tl.from(el, { y: 22, opacity: 0, duration: 0.55, ease: "power3.out" });

      const fade = gsap.utils.toArray<HTMLElement>('[data-reveal="fade"]', el);
      if (fade.length) {
        tl.from(
          fade,
          {
            y: 8,
            opacity: 0,
            duration: 0.38,
            stagger: 0.07,
            ease: "power2.out",
          },
          "-=0.3",
        );
      }

      const wipe = gsap.utils.toArray<HTMLElement>('[data-reveal="wipe"]', el);
      for (const node of wipe) {
        // The end value is authored in the markup as the static transform, so
        // the card is correct before this ever runs. `data-fill` just tells the
        // tween what to animate back up to.
        const target = Number(node.dataset.fill ?? 1);
        tl.fromTo(
          node,
          { scaleX: 0 },
          { scaleX: target, duration: 0.46, ease: "power2.out" },
          "-=0.22",
        );
      }

      const draw = gsap.utils.toArray<HTMLElement>('[data-reveal="draw"]', el);
      if (draw.length) {
        tl.fromTo(
          draw,
          { scaleY: 0 },
          { scaleY: 1, duration: 0.4, stagger: 0.06, ease: "power2.out" },
          "-=0.3",
        );
      }

      const pop = gsap.utils.toArray<HTMLElement>('[data-reveal="pop"]', el);
      if (pop.length) {
        tl.from(
          pop,
          {
            scale: 0.72,
            opacity: 0,
            duration: 0.36,
            stagger: 0.06,
            ease: "back.out(2.2)",
          },
          "-=0.28",
        );
      }

      ScrollTrigger.create({
        trigger: el,
        // 88% rather than the viewport edge: the card should already be moving
        // by the time it is properly in view, not start the instant it appears.
        start: "top 88%",
        once: true,
        onEnter: () => {
          el.classList.remove("await-view");
          tl.play();
        },
      });
    }, el);

    return () => {
      ctx.revert();
      el.classList.remove("await-view");
    };
  }, [reduced, delay]);

  return (
    // A callback ref rather than the object: `Tag` is a union, and a single
    // `RefObject` cannot satisfy both `HTMLDivElement` and `HTMLLIElement`
    // without a cast that would outlive the reason for it.
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node;
      }}
      className={className}
    >
      {children}
    </Tag>
  );
}
