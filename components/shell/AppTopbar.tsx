"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import {
  Breadcrumbs,
  type BreadcrumbItem,
} from "@/components/shell/Breadcrumbs";
import { NotificationPopover } from "@/components/shell/NotificationPopover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { SidebarVariant } from "@/components/shell/AppSidebar";

/**
 * Sticky topbar.
 *
 * Left slot: the sidebar trigger (drawer on mobile, rail toggle on desktop),
 * then the breadcrumb trail. Right slot: notifications.
 *
 * Deliberately translucent over the linen rather than a solid bar — a hard
 * white strip cuts the page in two and fights the calm the palette is for.
 *
 * `breadcrumbs` is the prop pattern later pages supply. Most render them via
 * `PageHeader` instead, adjacent to the title; this slot exists for pages that
 * want persistent context while scrolling.
 */
export interface AppTopbarProps {
  variant?: SidebarVariant;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function AppTopbar({ breadcrumbs, className }: AppTopbarProps) {
  const t = useTranslations("shell");

  return (
    <header
      className={cn(
        "bg-bg/80 border-border sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1 border-b px-3 backdrop-blur-md lg:px-6",
        className,
      )}
    >
      <SidebarTrigger aria-label={t("toggleSidebar")} />

      <div className="min-w-0 flex-1 pl-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumbs items={breadcrumbs} />
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationPopover />
      </div>
    </header>
  );
}
