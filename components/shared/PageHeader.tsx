import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Breadcrumbs,
  type BreadcrumbItem,
} from "@/components/shell/Breadcrumbs";

/**
 * The single <h1> of every page in the app.
 *
 * No later page writes its own heading — that is what keeps the title size,
 * weight and the 32px gap to content identical across eighteen prompts. It is
 * also the single place display type is applied to a page title, which is what
 * makes `.display` (Fraunces) consistent app-wide rather than per-screen.
 *
 * ── Matched to the landing page ───────────────────────────────────────────
 * The title is PINE, not espresso, and the eyebrow is an almond pill with a
 * pine dot rather than letter-spaced caps. Both are lifted verbatim from the
 * marketing sections (`Hero`, `CheckCatalogue`, `DriftGallery`) so a visitor
 * who signs up does not land somewhere that looks like a different product.
 *
 * Pine also spends the identity where `globals.css` asks for it — "if a
 * screenshot reads as a beige app with green accents, the green has been
 * under-used". `text-primary` is 10.32:1 on linen and 11.64:1 on a card, so
 * the change costs nothing in contrast.
 *
 * This is shared chrome: the change lands on every screen, which is the point.
 * A dashboard that matched the landing page while `papers` and `settings` did
 * not would be a new inconsistency, not a fixed one.
 */
export interface PageHeaderProps {
  title: string;
  /**
   * Small caps line above the title — a date, a section, a context. Lives here
   * rather than in the page so the eyebrow→title spacing is set once; a page
   * that hand-rolls one immediately drifts from the rest.
   */
  eyebrow?: string;
  description?: string;
  /** Right-aligned action slot — buttons, menus. */
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div className="mb-3">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-3">
              <span className="bg-primary-soft text-primary inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium">
                <span
                  aria-hidden="true"
                  className="bg-primary size-1.5 rounded-full"
                />
                {eyebrow}
              </span>
            </p>
          ) : null}
          <h1 className="display text-page-title text-primary">{title}</h1>
          {description ? (
            <p className="text-body text-muted mt-1 max-w-2xl">{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
