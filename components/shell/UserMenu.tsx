"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn, initialFromEmail, truncateMiddle } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "@/i18n/routing";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconChevronUpDown, IconSettings, IconSignOut } from "@/components/icons";
import { IconMotion, useIconMotion } from "@/components/motion/IconMotion";

/**
 * Pinned user block at the foot of the pine rail.
 *
 * Colours come from the `--color-sidebar*` family, not the page palette: this
 * sits on pine, where `text-ink` would be invisible. Collapsing is driven by
 * the rail's own `group-data-[collapsible=icon]` state rather than a prop, so
 * it can never disagree with the rail it lives in.
 *
 * Reads `useAuth()`, which is a stub in P0 — with no session the email falls
 * back to a placeholder dash and the avatar to "?". P2 makes both real without
 * touching this file.
 */
export function UserMenu() {
  const t = useTranslations("common");
  const tShell = useTranslations("shell");
  const { user, signOut } = useAuth();
  const router = useRouter();
  /* On the trigger rather than around the chevron: the whole block is the
     control, and the chevron is the only part of it that can move. */
  const { ref: triggerRef } = useIconMotion<HTMLButtonElement>();

  const email = user?.email ?? "—";

  const handleSignOut = React.useCallback(async () => {
    await signOut();
    router.push(ROUTES.signIn);
  }, [signOut, router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={tShell("accountMenu")}
          className={cn(
            "hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex w-full items-center gap-2.5 rounded-full p-1.5 pr-3 transition-colors duration-200 ease-out-quiet focus-visible:ring-2 focus-visible:outline-none",
            /* 36px of inner rail (see SidebarContent) minus 2×4px padding
               leaves exactly the 28px the avatar needs. `p-1.5` left it 4px
               short and the avatar bled over the rail edge. */
            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1",
          )}
        >
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-[11px]">
              {initialFromEmail(user?.email)}
            </AvatarFallback>
          </Avatar>

          <span className="flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:hidden">
            <span className="text-meta text-sidebar-foreground/85 min-w-0 flex-1 truncate text-left">
              {truncateMiddle(email, 22)}
            </span>
            <IconChevronUpDown
              className="text-sidebar-foreground/50 size-3.5 shrink-0"
              aria-hidden="true"
            />
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-60">
        {/* The identity block reads as a header, not a menu row — hence the
            avatar echo. No caption under the address: "Account menu" was the
            aria-label leaking into visible copy, and it named the thing the
            user just opened. */}
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-primary-soft text-primary text-[11px] font-medium">
              {initialFromEmail(user?.email)}
            </AvatarFallback>
          </Avatar>
          <span className="text-meta text-ink min-w-0 truncate">{email}</span>
        </div>
        <DropdownMenuSeparator />
        {/* Wrapping is safe inside a menu item — `DropdownMenuItem` sizes its
            glyph with the descendant `[&_svg]`, not a child selector, so the
            `display: contents` span is invisible to it. */}
        <DropdownMenuItem onSelect={() => router.push(ROUTES.settings)}>
          <IconMotion within="[role=menuitem]">
            <IconSettings aria-hidden="true" />
          </IconMotion>
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => void handleSignOut()}
        >
          <IconMotion within="[role=menuitem]">
            <IconSignOut aria-hidden="true" />
          </IconMotion>
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
