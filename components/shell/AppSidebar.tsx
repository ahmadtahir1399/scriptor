"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ROUTES } from "@/lib/constants";
import { Link, usePathname } from "@/i18n/routing";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  IconActivity,
  IconDashboard,
  IconFlask,
  IconLeaf,
  IconFindings,
  IconLibrary,
  IconRequirements,
  IconSettings,
  IconUpload,
  IconUsers,
  type IconProps,
} from "@/components/icons";
import { useIconMotion } from "@/components/motion/IconMotion";
import { UserMenu } from "@/components/shell/UserMenu";

/**
 * The pine rail.
 *
 * Student and admin are the same component with a different item list — the
 * two must never diverge in how a row looks, only in what the rows are.
 *
 * The nav config is assembled in this client component rather than passed down
 * from the server layout because icon components are functions and cannot
 * cross the server/client boundary as props.
 */

export type SidebarVariant = "app" | "admin";

interface NavEntry {
  href: string;
  label: string;
  icon: React.ComponentType<IconProps>;
  exact?: boolean;
}

function useNavGroups(variant: SidebarVariant): {
  label: string;
  items: NavEntry[];
}[] {
  const t = useTranslations("nav");

  return React.useMemo(() => {
    if (variant === "admin") {
      return [
        {
          label: t("groups.operations"),
          items: [
            {
              href: ROUTES.admin,
              label: t("admin.overview"),
              icon: IconDashboard,
              exact: true,
            },
            {
              href: ROUTES.adminAnalyses,
              label: t("admin.analyses"),
              icon: IconActivity,
            },
          ],
        },
        {
          label: t("groups.tuning"),
          items: [
            {
              href: ROUTES.adminChecks,
              label: t("admin.checks"),
              icon: IconFindings,
            },
            {
              href: ROUTES.adminEvals,
              label: t("admin.evals"),
              icon: IconFlask,
            },
            {
              href: ROUTES.adminUsers,
              label: t("admin.users"),
              icon: IconUsers,
            },
          ],
        },
      ];
    }

    return [
      {
        label: t("groups.workspace"),
        items: [
          {
            href: ROUTES.dashboard,
            label: t("dashboard"),
            icon: IconDashboard,
            exact: true,
          },
          { href: ROUTES.papers, label: t("papers"), icon: IconLibrary },
          { href: ROUTES.upload, label: t("upload"), icon: IconUpload },
          {
            href: ROUTES.requirements,
            label: t("requirements"),
            icon: IconRequirements,
          },
        ],
      },
    ];
  }, [variant, t]);
}

export function AppSidebar({ variant = "app" }: { variant?: SidebarVariant }) {
  const t = useTranslations();
  const groups = useNavGroups(variant);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <BrandRow variant={variant} />
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavRow key={item.href} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <NavRow
            item={{
              href: ROUTES.settings,
              label: t("nav.settings"),
              icon: IconSettings,
            }}
          />
        </SidebarMenu>
        <SidebarSeparator />
        <UserMenu />
      </SidebarFooter>

      <SidebarRail aria-label={t("shell.toggleSidebar")} />
    </Sidebar>
  );
}

/**
 * Brand lockup. Collapses to the leaf alone — the wordmark is clipped by the
 * rail width rather than conditionally unmounted, so nothing reflows.
 */
function BrandRow({ variant }: { variant: SidebarVariant }) {
  const t = useTranslations("common");
  const { setOpenMobile, isMobile } = useSidebar();
  /* The ref goes on the lockup, so hovering the wordmark opens the leaf too —
     they are one thing, and only one of them can be animated. Destructured at
     the call site, never `motion.ref` in the JSX — see `useIconMotion`. */
  const { ref: brandRef } = useIconMotion<HTMLAnchorElement>();

  return (
    <Link
      ref={brandRef}
      href={ROUTES.papers}
      onClick={() => {
        if (isMobile) setOpenMobile(false);
      }}
      className="focus-visible:ring-sidebar-ring flex h-10 items-center gap-2.5 rounded-md px-1.5 focus-visible:ring-2 focus-visible:outline-none"
    >
      <IconLeaf className="text-sidebar-foreground size-6 shrink-0" />
      <span className="flex min-w-0 items-baseline gap-2 group-data-[collapsible=icon]:hidden">
        <span className="display text-sidebar-foreground truncate text-[19px] leading-none">
          {t("appName")}
        </span>
        {variant === "admin" ? (
          <span className="eyebrow text-decor shrink-0">{t("admin")}</span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * One nav row. The honey dot is the ONLY metallic in the sidebar and marks
 * exactly one row — it is what makes "where am I" readable at a glance on a
 * rail where every row is the same pine.
 *
 * Closing the mobile drawer happens in `onClick`, not in an effect watching
 * the pathname: an effect would fire on every navigation including ones that
 * did not come from this menu, and `react-hooks/set-state-in-effect` rejects
 * it for good reason.
 *
 * ── Every row's icon moves, and each one moves differently ───────────────
 * The gesture is not chosen here. `useIconMotion` reads `data-icon` off the
 * glyph and looks the motion up in `lib/motion/iconGestures.ts`, so the upload
 * arrow lifts, the library flips and the settings bloom opens — from one ref,
 * with the nav config untouched. Adding a nav entry gets the right motion for
 * free; picking it per row here is how the two would drift.
 *
 * The ref goes on the LINK, not around the icon: the whole row is the hover
 * target, and `SidebarMenuButton` reaches its glyph with `[&>svg]` and clips
 * its label with `[&>span]:hidden` when the rail collapses — so an element
 * inserted between the two would unsize the icon and then hide it.
 */
function NavRow({ item }: { item: NavEntry }) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const { ref: rowRef } = useIconMotion<HTMLAnchorElement>();

  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link
          ref={rowRef}
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
        >
          <Icon aria-hidden="true" />
          <span className="truncate">{item.label}</span>
          {isActive ? (
            <span
              aria-hidden="true"
              className="bg-decor ml-auto size-1.5 shrink-0 rounded-full group-data-[collapsible=icon]:hidden"
            />
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
