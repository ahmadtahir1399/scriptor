import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-surface text-ink border-border rounded-lg border shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex items-start justify-between gap-4 px-5 pt-5 pb-4",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Pine rather than espresso, matching the tile headings in the marketing
 * sections. `text-primary` is 11.64:1 on `--color-surface`, so this is a
 * colour change with no contrast cost, and it is what makes an app screen and
 * a landing section read as the same product.
 */
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("display text-section-title text-primary", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-meta text-muted mt-1", className)}
      {...props}
    />
  );
}

/**
 * The control parked at the top-right of a card — a filter, a menu, a link.
 *
 * `CardHeader` is already `flex … justify-between`, so this only has to refuse
 * to shrink and keep its own contents aligned to the right; upstream shadcn
 * needs grid placement classes here because its header is a grid.
 */
export function CardAction({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("flex shrink-0 items-center justify-end gap-2", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 pb-5", className)}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "border-border flex items-center gap-2 border-t px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}
