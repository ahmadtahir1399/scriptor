import * as React from "react";
import { setRequestLocale } from "next-intl/server";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/shell/AppShell";
import { ROUTES } from "@/lib/constants";
import { readSidebarDefaultOpen } from "@/lib/shell/sidebarCookie";

/**
 * The authenticated student shell.
 *
 * Wraps every page built in P2–P15. The sidebar and topbar are constructed
 * once, here — no page below this layout renders its own navigation.
 *
 * `RequireAuth` is a P0 stub that renders children directly; P2 replaces its
 * internals with a real session check. Because it already sits at its final
 * path with its final props, this file never has to change again.
 */
export default async function AppLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Parallel: the cookie read has no dependency on locale resolution, and the
  // database is in Tokyo — nothing here may await sequentially without reason.
  const defaultOpen = await readSidebarDefaultOpen();

  return (
    <RequireAuth redirectTo={ROUTES.signIn}>
      <AppShell variant="app" defaultOpen={defaultOpen}>
        {children}
      </AppShell>
    </RequireAuth>
  );
}
