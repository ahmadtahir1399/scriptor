"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/routing";

/**
 * The two-section settings nav: general settings and the data & privacy page.
 * Kept deliberately plain — this whole area reads as a calm, precise security
 * settings screen, not a playful product surface.
 */
export function SettingsNav() {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();

  const tabs = [
    { href: "/settings", key: "general" as const, exact: true },
    { href: "/settings/data", key: "data" as const, exact: false },
  ];

  return (
    <nav
      className="border-border mb-6 flex items-center gap-1 border-b"
      aria-label={t("label")}
    >
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-body font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
