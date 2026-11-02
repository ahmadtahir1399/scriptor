import * as React from "react";

import { cn } from "@/lib/utils";
import type { IconProps } from "@/components/icons";
import { DrawOnMount } from "@/components/motion/DrawOnMount";

/**
 * The empty state used by every list, tab and panel in the app.
 *
 * There is never a bare "no data" string anywhere — an empty view is a chance
 * to tell the student what would appear here and what to do about it, and a
 * consistent one reads as a considered product rather than a missing feature.
 */
export interface EmptyStateProps {
  icon: React.ComponentType<IconProps>;
  title: string;
  description?: string;
  /** Primary action — usually a single Button. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      {/*
       * A sage ring rather than a filled almond disc. An empty state should
       * read as "room for something", not as a heavy placeholder chip.
       */}
      {/*
       * The icon DRAWS itself in. An empty state is the one moment where the
       * screen has nothing to say, so it is the right place to spend a little
       * motion — and because the icon set carries `pathLength` on every
       * stroke, this costs one wrapper and no per-icon work.
       *
       * `DrawOnMount` is the only client boundary; the icon and this component
       * stay server-rendered.
       */}
      <div className="bg-verified-soft ring-green-200 flex size-14 items-center justify-center rounded-full ring-1">
        <DrawOnMount duration={760} delay={90}>
          <Icon className="text-verified" size={22} aria-hidden="true" />
        </DrawOnMount>
      </div>

      <p className="display text-section-title text-ink mt-4">{title}</p>

      {description ? (
        <p className="text-body text-muted mt-1 max-w-sm">{description}</p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
