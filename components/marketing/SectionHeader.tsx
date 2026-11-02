import * as React from "react";

import { cn } from "@/lib/utils";
import { RevealOnView } from "@/components/marketing/RevealOnView";

/**
 * The opening block of a marketing section — in three deliberately different
 * shapes.
 *
 * Four sections had shipped with an identical opening: almond pill, pine
 * headline, muted subhead, left-aligned, same measure, same ground. Read
 * end to end that is one section repeated four times, and the eye stops
 * finding anything to land on.
 *
 * The ground could not carry the variation. A pine band and an almond wash
 * were both tried and rejected — green belongs in the TYPE on linen, not in a
 * slab. So the rhythm comes from structure instead: alignment, measure, and
 * whether the subhead sits under the headline or beside it.
 *
 * Variants are a closed set on purpose. Three shapes used deliberately reads
 * as a system; five improvised ones read as drift.
 *
 *   left   — the default. Scanning shape, for a section that is a list.
 *   center — a statement. For the one section that is the argument's pivot;
 *            costs its own row of vertical space, so it is used once.
 *   split  — headline against a body column. For a section whose subhead is
 *            long enough to need its own measure, and which has a second
 *            thought worth putting beside it rather than below.
 */

export interface SectionHeaderProps {
  eyebrow: string;
  headline: string;
  subhead: string;
  variant?: "left" | "center" | "split";
  /** Rule-and-label, or the almond pill. Alternated between sections. */
  eyebrowStyle?: "pill" | "rule";
  /** Only rendered by `split`, beneath the subhead in the right column. */
  aside?: React.ReactNode;
  className?: string;
}

function Eyebrow({
  children,
  style,
  centered,
}: Readonly<{ children: string; style: "pill" | "rule"; centered: boolean }>) {
  if (style === "pill") {
    return (
      // Solid pine rather than pine-on-almond. Small, but it is the one place
      // per section where the brand colour is a FILL instead of type, which is
      // what stops the page reading as "beige with green text".
      // `primary-foreground` on `primary` is 10.32:1.
      <span
        data-reveal="pop"
        className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium"
      >
        <span
          aria-hidden="true"
          className="bg-primary-foreground/60 size-1.5 rounded-full"
        />
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center gap-3",
        centered && "justify-center",
      )}
    >
      {/* Pine, and a rule rather than a fill — this is chrome, not a status.
          It draws outward from the text instead of appearing whole. */}
      <span
        data-reveal="wipe"
        aria-hidden="true"
        className="bg-primary h-px w-8 origin-left"
      />
      <span className="eyebrow text-primary text-[11px]">{children}</span>
      {centered ? (
        <span
          data-reveal="wipe"
          aria-hidden="true"
          className="bg-primary h-px w-8 origin-right"
        />
      ) : null}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  headline,
  subhead,
  variant = "left",
  eyebrowStyle = "pill",
  aside,
  className,
}: SectionHeaderProps) {
  const headlineClass =
    "display text-primary text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.1] text-balance";

  if (variant === "center") {
    return (
      <RevealOnView className={cn("mx-auto max-w-[54ch] text-center", className)}>
        <Eyebrow style={eyebrowStyle} centered>
          {eyebrow}
        </Eyebrow>
        <h2 data-reveal="fade" className={cn(headlineClass, "mt-5")}>
          {headline}
        </h2>
        <p
          data-reveal="fade"
          className="text-muted mx-auto mt-4 max-w-[52ch] text-[16px] leading-relaxed"
        >
          {subhead}
        </p>
      </RevealOnView>
    );
  }

  if (variant === "split") {
    return (
      <RevealOnView
        className={cn(
          "grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14",
          className,
        )}
      >
        <div>
          <Eyebrow style={eyebrowStyle} centered={false}>
            {eyebrow}
          </Eyebrow>
          {/* Wider measure than `left` uses: this headline is carrying the
              column on its own, so it is allowed more room to break. */}
          <h2 data-reveal="fade" className={cn(headlineClass, "mt-5 max-w-[18ch]")}>
            {headline}
          </h2>
        </div>

        <div className="lg:pt-9">
          <p
            data-reveal="fade"
            className="text-muted text-[16px] leading-relaxed"
          >
            {subhead}
          </p>
          {aside ? <div className="mt-6">{aside}</div> : null}
        </div>
      </RevealOnView>
    );
  }

  return (
    <RevealOnView className={cn("max-w-[62ch]", className)}>
      <Eyebrow style={eyebrowStyle} centered={false}>
        {eyebrow}
      </Eyebrow>
      <h2 data-reveal="fade" className={cn(headlineClass, "mt-5")}>
        {headline}
      </h2>
      <p data-reveal="fade" className="text-muted mt-4 text-[16px] leading-relaxed">
        {subhead}
      </p>
    </RevealOnView>
  );
}
