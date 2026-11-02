"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { IconArrowRight } from "@/components/icons";

/**
 * Breadcrumb trail: app name > section > page.
 *
 * Pages supply `items` through `PageHeader`; the topbar renders the same
 * component from its breadcrumb slot. The final item is always the current
 * page and is never a link.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Prepends the app name as the first crumb. */
  showRoot?: boolean;
  className?: string;
}

export function Breadcrumbs({
  items,
  showRoot = true,
  className,
}: BreadcrumbsProps) {
  const t = useTranslations();

  const crumbs: BreadcrumbItem[] = showRoot
    ? [{ label: t("common.appName"), href: "/papers" }, ...items]
    : items;

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label={t("shell.breadcrumb")}
      className={cn("min-w-0", className)}
    >
      <ol className="text-meta text-muted flex items-center gap-1.5">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li
              key={`${crumb.label}-${index}`}
              className="flex min-w-0 items-center gap-1.5"
            >
              {index > 0 ? (
                <IconArrowRight
                  className="size-3.5 shrink-0 opacity-60"
                  aria-hidden="true"
                />
              ) : null}

              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="hover:text-ink truncate transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn("truncate", isLast && "text-ink font-medium")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
