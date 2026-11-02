"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, type SidebarVariant } from "@/components/shell/AppSidebar";
import { AppTopbar } from "@/components/shell/AppTopbar";

/**
 * The chrome that wraps every authenticated page.
 *
 * Client, because the rail owns interaction state — but `children` arrive as a
 * prop from the Server Component layout above, so every page below this stays
 * server-rendered. Nothing in here forces a page into the client bundle.
 *
 * `defaultOpen` is read from the sidebar cookie by the layout, so the rail
 * renders at its true width during SSR instead of snapping after hydration.
 *
 * The mobile bottom bar is gone: the drawer now carries the full nav for both
 * variants, which removes the abbreviated second label set it needed and gives
 * the PDF viewer back 56px on the smallest screens.
 */
export interface AppShellProps {
  children: React.ReactNode;
  variant?: SidebarVariant;
  defaultOpen?: boolean;
}

export function AppShell({
  children,
  variant = "app",
  defaultOpen = true,
}: AppShellProps) {
  const t = useTranslations("shell");

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen={defaultOpen}>
        {/*
         * Skip link. `tabIndex={-1}` on <main> below is what makes it actually
         * move focus — without it the browser scrolls and focus stays on the
         * link, which is a silent failure that reads as "the skip link works".
         */}
        <a
          href="#main-content"
          className={cn(
            "sr-only z-50 focus:not-sr-only focus:fixed focus:top-3 focus:left-3",
            "focus:bg-surface focus:text-ink focus:shadow-lift focus:rounded-md focus:px-4 focus:py-2",
          )}
        >
          {t("skipToContent")}
        </a>

        <AppSidebar variant={variant} />

        <SidebarInset id="main-content" tabIndex={-1}>
          <AppTopbar variant={variant} />

          {/*
           * The canvas.
           *
           * 1200px was a reading measure, and this app is not a reading
           * column — its widest screen is the document viewer, which is a
           * three-pane split (thumbnails · page · findings rail) and was being
           * squeezed into ~840px of usable width once the rail took its 340px.
           * 1600 gives the split room and still stops the dashboard's cards
           * from stretching into letterboxes on an ultrawide.
           */}
          <div className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-8 lg:px-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
