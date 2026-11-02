import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Every button is a capsule.
 *
 * `rounded-full` rather than `--radius-md`: a pill is the softest shape a
 * control can take, it matches the field capsules, and it means button radius
 * never has to be re-tuned when the radius scale moves.
 *
 * Motion: colour AND transform, so a press has weight. `active:scale-[0.97]`
 * is the whole interaction — no bounce, no shadow pop.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-body font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out-quiet active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /*
         * `hover:bg-primary-hover` is a real ramp step (green-700), not
         * `bg-primary/90`. An alpha fade on pine lets the linen through and
         * the button goes muddy-warm on hover instead of lifting; stepping up
         * the ramp keeps it green.
         */
        default:
          "bg-primary text-primary-foreground shadow-card hover:bg-primary-hover",
        destructive:
          "bg-critical text-critical-foreground shadow-card hover:bg-critical/90",
        outline:
          "border border-border bg-surface text-ink shadow-card hover:border-green-400 hover:bg-primary-soft/40",
        secondary: "bg-primary-soft text-primary hover:bg-primary-soft/70",
        ghost: "text-ink hover:bg-primary-soft/45",
        link: "text-primary underline-offset-4 hover:underline",
        /*
         * For buttons sitting ON `.pine-panel` — the hero card, the sidebar,
         * the completion card. `default` would put pine on pine and vanish.
         * Linen fill with pine text is 10.32:1 either way round, and the
         * panel's own `:focus-visible` rule already swaps the ring to almond
         * so the focus state survives the gradient.
         */
        onPanel:
          "bg-panel-foreground text-primary shadow-card hover:bg-panel-foreground/88",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3.5 text-meta",
        lg: "h-11 px-6",
        icon: "size-10",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }));

  /*
   * `Slot` THROWS when `asChild` receives anything other than exactly one
   * React element — an array, a bare string, a fragment holding several nodes.
   * That throw propagates to the nearest error boundary, so one malformed
   * button replaces the entire page with "Something went wrong".
   *
   * A button is never worth a blank screen. Degrade to a real <button> and say
   * loudly what actually arrived, so the offending call site names itself in
   * the console instead of hiding behind a generic Radix message.
   */
  if (asChild && !React.isValidElement(props.children)) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[Button] `asChild` requires exactly one React element child. Received:",
        props.children,
        "— rendering a plain <button> instead.",
      );
    }
    return <button data-slot="button" className={classes} {...props} />;
  }

  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={classes} {...props} />;
}

export { buttonVariants };
