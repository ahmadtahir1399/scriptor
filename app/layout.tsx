import * as React from "react";
import type { Metadata } from "next";
import { Fraunces, Inter, Source_Serif_4 } from "next/font/google";
import { getLocale } from "next-intl/server";

import "./globals.css";

import { AnimatedFavicon } from "@/components/brand/AnimatedFavicon";
import { APP_NAME } from "@/lib/constants";

/**
 * Root layout — owns <html> and <body>.
 *
 * Next 16 validates that the TRUE root layout (this file) carries the html and
 * body tags; a pass-through root that defers them to `[locale]/layout.tsx`
 * throws "Missing <html> and <body> tags in the root layout". Owning them here
 * also gives the non-localised `/auth/*` routes a valid document shell, which
 * they otherwise lacked entirely.
 *
 * The `lang` attribute still needs the resolved locale, but this layout has no
 * `[locale]` param. `getLocale()` reads it from the request config that
 * `i18n/request.ts` resolves — and falls back to the default locale for the
 * unprefixed `/auth/*` routes, which is correct.
 *
 * Font CSS-variable classNames live on <html> because that is the element the
 * variables must cascade from; they are locale-independent, so they belong
 * here rather than in the locale layout.
 */

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Source Serif 4 — the STUDENT's voice.
 *
 * Bound to `--font-serif` and used only by `.prose-thesis`: thesis excerpts,
 * quoted passages, extracted paragraphs. It is not display type and must not
 * be used as such.
 */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-serif",
  display: "swap",
});

/**
 * Fraunces — the PRODUCT's voice.
 *
 * Bound to `--font-display` and used only by `.display`: page titles, the
 * score gauge value, stat numbers, card titles. Keeping our display face and
 * the student's prose face distinct is deliberate — collapsing them into one
 * serif would blur whose words are on screen, which is the whole point of a
 * supervision tool.
 *
 * Loaded as a variable font (no `weight`) so the full 300–700 range is one
 * file and `font-variation-settings` can reach the `opsz` and `SOFT` axes that
 * `.display` drives. `display: "swap"` matters more here than elsewhere: the
 * fallback is Georgia, metrically close enough that the swap is not a layout
 * jolt, and a blocked display font would otherwise leave every page title
 * invisible.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: "AI thesis supervision for university students.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${sourceSerif.variable} ${fraunces.variable}`}
    >
      <body>
        {/* Renders nothing; owns the tab icon. Mounted here rather than in a
            route group so the marketing pages, the app shell and `/auth/*`
            all share one icon. */}
        <AnimatedFavicon />
        {children}
      </body>
    </html>
  );
}
