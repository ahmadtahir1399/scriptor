import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-sm border px-2 py-0.5 text-micro font-medium whitespace-nowrap uppercase tracking-wide [&_svg]:size-3 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-primary-soft text-primary",
        outline: "border-border text-muted",
        verified: "border-transparent bg-verified-soft text-verified",
        warning: "border-transparent bg-warning-soft text-warning",
        critical: "border-transparent bg-critical-soft text-critical",
        ai: "border-transparent bg-ai-soft text-ai",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

export function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: BadgeProps) {
  const classes = cn(badgeVariants({ variant }), className);

  // Same guard as Button: `Slot` throws on anything but a single element, and
  // a badge must never be the reason a page renders an error boundary.
  if (asChild && !React.isValidElement(props.children)) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[Badge] `asChild` requires exactly one React element child. Received:",
        props.children,
        "— rendering a plain <span> instead.",
      );
    }
    return <span data-slot="badge" className={classes} {...props} />;
  }

  const Comp = asChild ? Slot : "span";
  return <Comp data-slot="badge" className={classes} {...props} />;
}

export { badgeVariants };
