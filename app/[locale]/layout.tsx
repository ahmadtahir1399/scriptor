import * as React from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";

import { routing } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider, type AuthUser } from "@/providers/AuthProvider";

/**
 * Locale layout — providers only.
 *
 * <html> and <body> are owned by the root `app/layout.tsx` (Next 16 requires
 * them there). This layout renders strictly inside <body>, so it must NOT
 * emit its own — nested html/body is invalid and would break hydration.
 *
 * It wraps everything under `[locale]` in the fixed provider order. The
 * non-localised `/auth/*` pages sit outside this layout; they are minimal,
 * server-rendered, and need none of these providers.
 */

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  // Next 16: dynamic route params are async and must be awaited.
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Opts this segment into static rendering for the resolved locale.
  setRequestLocale(locale);

  /*
   * Resolve the session server-side and hand it to AuthProvider, so the first
   * client render already knows who the user is. Without this the sidebar user
   * block flashes a signed-out state on every navigation.
   *
   * `role` comes from here and only from here — the browser cannot read
   * user_roles for anyone, so the client must never invent one.
   */
  const sessionUser = await getSessionUser();
  const initialUser: AuthUser | null = sessionUser
    ? {
        id: sessionUser.id,
        email: sessionUser.email,
        role: sessionUser.roles.includes("ADMIN") ? "ADMIN" : "STUDENT",
      }
    : null;

  return (
    <NextIntlClientProvider>
      {/* Provider order is fixed: Theme → Query → Auth → children → Toaster. */}
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider initialUser={initialUser}>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                classNames: {
                  toast:
                    "bg-surface border border-border text-ink rounded-md shadow-popover",
                  description: "text-muted",
                  actionButton: "bg-primary text-primary-foreground",
                  cancelButton: "bg-bg text-muted",
                },
              }}
            />
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
