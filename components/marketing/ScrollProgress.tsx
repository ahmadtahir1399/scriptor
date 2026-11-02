"use client";

import * as React from "react";

import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { gsap } from "@/lib/motion/gsap";

/**
 * Publishes scroll progress as `--read` (0 → 1) on its own element.
 *
 * The header uses it to fill itself in as the page is read. That is the one
 * idea in this design that is actually about the product: Scriptor's claim is
 * that it reads a document end to end, so the chrome reads the page end to end
 * in front of you. A generic progress bar pinned to the viewport edge would be
 * the same mechanic making no argument.
 *
 * Quantised to 3 decimals before writing. A raw scroll ratio changes every
 * frame and each change invalidates style on a backdrop-blurred, sticky
 * element — the one composite in this layout expensive enough to notice.
 */
export function ScrollProgress({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion still gets the indicator — it conveys position, which is
    // information, not decoration. It simply stops being smoothed.
    let last = -1;
    const write = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const next = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const rounded = Math.round(next * 1000) / 1000;
      if (rounded !== last) {
        last = rounded;
        el.style.setProperty("--read", String(rounded));
      }
    };

    write();

    if (reduced) {
      window.addEventListener("scroll", write, { passive: true });
      window.addEventListener("resize", write);
      return () => {
        window.removeEventListener("scroll", write);
        window.removeEventListener("resize", write);
      };
    }

    // Driven by GSAP's ticker so it shares the frame with Lenis rather than
    // racing it on a separate scroll listener.
    gsap.ticker.add(write);
    window.addEventListener("resize", write);
    return () => {
      gsap.ticker.remove(write);
      window.removeEventListener("resize", write);
    };
  }, [reduced]);

  return (
    <div ref={ref} className={className} style={{ "--read": 0 } as React.CSSProperties}>
      {children}
    </div>
  );
}
