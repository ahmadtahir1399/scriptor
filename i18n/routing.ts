import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

/**
 * Locale routing. English only — the German UI locale was removed.
 *
 * The `[locale]` route segment is deliberately KEPT. `localePrefix:
 * "as-needed"` means the single default locale is never prefixed, so every
 * URL is already the bare path (`/papers`, not `/en/papers`) and nothing is
 * gained by tearing the segment out of forty route files. Adding a locale
 * back is then a one-line change here plus a messages file.
 *
 * Note this is the INTERFACE language only. The product still analyses German
 * theses — `spelling_variant` (DE_DE, DE_CH), the `app_locale` column and the
 * German columns on `checks` are untouched.
 */
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type Locale = (typeof routing.locales)[number];

/**
 * Locale-aware navigation primitives.
 *
 * Every prompt from here on imports `Link` and `useRouter` from THIS module,
 * never from `next/link` or `next/navigation` — otherwise the locale prefix is
 * dropped and German users get bounced back to English on every click.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
