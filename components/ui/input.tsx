import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The single-line text field.
 *
 * A soft almond WELL rather than a boxed outline. The old treatment was a 1px
 * border on a white box — correct, and completely generic. Here the resting
 * state is a filled, borderless capsule that reads as part of the page, and
 * FOCUS is what lifts it: the fill turns to card surface, a sage hairline
 * appears, and a wide low-opacity ring blooms around it.
 *
 * That inversion is the point. Most forms shout at rest and whisper on focus;
 * this one is quiet until you touch it, which is what makes a page of inputs
 * feel calm.
 *
 * `rounded-full` is deliberate for single-line fields — a capsule is the
 * softest possible shape and matches the pill buttons. Multi-line lives in
 * `Textarea`, which cannot be a capsule and uses `--radius-lg` instead.
 */
export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "text-body text-ink placeholder:text-muted-soft flex h-11 w-full rounded-full border border-transparent px-4",
        "bg-primary-soft/45",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-out-quiet",
        "hover:bg-primary-soft/65",
        "focus-visible:bg-surface focus-visible:border-green-400 focus-visible:ring-primary/12 focus-visible:ring-4 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-invalid:border-critical aria-invalid:ring-critical/15 aria-invalid:ring-4",
        // File inputs render their own button; strip its chrome so it inherits.
        "file:text-ink file:mr-3 file:border-0 file:bg-transparent file:text-body file:font-medium",
        className,
      )}
      {...props}
    />
  );
}
