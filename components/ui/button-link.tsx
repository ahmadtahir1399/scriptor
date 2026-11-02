import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { LinkPending } from "@/components/ui/link-pending";

/**
 * A link that looks like a button.
 *
 * This exists because `<Button asChild><Link/></Button>` CRASHES in Server
 * Components: Radix's `Slot` has to introspect and clone its child, and in an
 * RSC render the child it receives is not a plain element it can clone, so it
 * throws "Slot failed to slot onto its children". The throw propagates to the
 * nearest error boundary, which means one styled link takes down the whole
 * page — the landing page 500s exactly this way.
 *
 * Composing the styles onto the `Link` directly sidesteps `Slot` entirely.
 * There is no `asChild`, no cloning, and nothing to go wrong on the server.
 *
 * `Link` is the localised one from `@/i18n/routing`, never `next/link`, so
 * `href` stays locale-relative and a second locale remains a routing change
 * rather than an audit.
 *
 * Use this for anything that NAVIGATES. Use `Button` for anything that ACTS.
 */
export interface ButtonLinkProps
  extends
    Omit<React.ComponentProps<typeof Link>, "className">,
    VariantProps<typeof buttonVariants> {
  className?: string;
}

export function ButtonLink({
  className,
  variant,
  size,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button-link"
      /* `relative` is what `LinkPending` positions against. First in the list
         so a caller passing its own positioning still wins the merge. */
      className={cn("relative", buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
      {/*
       * Every button-link gets the pending wash, rather than each call site
       * remembering to ask for it. These are the primary actions on the
       * landing page — the ones a first-time visitor clicks before anything is
       * warm — so they are exactly the ones that must not look dead.
       */}
      <LinkPending />
    </Link>
  );
}
