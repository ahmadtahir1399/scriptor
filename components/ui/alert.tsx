import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Variants follow the app's semantic colour contract:
 * navy = neutral/system, amber = review this, red = problem, green = verified.
 */
const alertVariants = cva(
  "relative flex w-full gap-3 rounded-md border p-4 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "bg-surface border-border text-ink [&>svg]:text-muted",
        info: "bg-primary-soft border-transparent text-primary [&>svg]:text-primary",
        warning:
          "bg-warning-soft border-transparent text-warning [&>svg]:text-warning",
        critical:
          "bg-critical-soft border-transparent text-critical [&>svg]:text-critical",
        verified:
          "bg-verified-soft border-transparent text-verified [&>svg]:text-verified",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface AlertProps
  extends React.ComponentProps<"div">, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-title"
      className={cn("text-body font-medium", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-meta mt-0.5 opacity-90", className)}
      {...props}
    />
  );
}
