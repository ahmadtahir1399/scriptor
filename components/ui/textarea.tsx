import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Multi-line text.
 *
 * Same well-to-surface focus treatment as `Input` — see the note there — but
 * `--radius-lg` instead of a capsule, because a capsule cannot hold more than
 * one line of text without its corners eating the first and last words.
 */
export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "text-body text-ink placeholder:text-muted-soft flex min-h-24 w-full rounded-lg border border-transparent px-4 py-3",
        "bg-primary-soft/45",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-out-quiet",
        "hover:bg-primary-soft/65",
        "focus-visible:bg-surface focus-visible:border-green-400 focus-visible:ring-primary/12 focus-visible:ring-4 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-invalid:border-critical aria-invalid:ring-critical/15 aria-invalid:ring-4",
        className,
      )}
      {...props}
    />
  );
}
