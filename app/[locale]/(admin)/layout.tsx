import * as React from "react";
import { setRequestLocale } from "next-intl/server";

import { RequireRole } from "@/components/auth/RequireRole";
import { AppShell } from "@/components/shell/AppShell";
import { readSidebarDefaultOpen } from "@/lib/shell/sidebarCookie";

/**
 * The admin shell — wraps P16 and P17.
 *
 * Identical primitives to the student shell, different nav items, plus a honey
 * "Admin" eyebrow beside the wordmark so the two are never confusable.
 *
 * `RequireRole` is a P0 stub. P2 makes it real; the authoritative check
 * remains RLS on the database, not this component.
 */
export default async function AdminLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const defaultOpen = await readSidebarDefaultOpen();

  return (
    <RequireRole role="ADMIN">
      <AppShell variant="admin" defaultOpen={defaultOpen}>
        {children}
      </AppShell>
    </RequireRole>
  );
}
