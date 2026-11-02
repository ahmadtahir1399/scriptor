import * as React from "react";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";

/**
 * Auth gate for the (app) route group.
 *
 * P2 replaced the internals. Path and props are unchanged from P0, so
 * `(app)/layout.tsx` did not need editing.
 *
 * A server component on purpose: the redirect happens before any child renders,
 * so no protected markup is ever streamed to an unauthenticated client. A
 * client-side guard would ship the page and then hide it.
 *
 * This is defence in depth, not the only control — `proxy.ts` redirects before
 * the request reaches here, and RLS is the authority underneath both.
 */
export interface RequireAuthProps {
  children: React.ReactNode;
  /** Where to send an unauthenticated visitor. */
  redirectTo?: string;
}

export async function RequireAuth({
  children,
  redirectTo = ROUTES.signIn,
}: RequireAuthProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(redirectTo);
  }

  return <>{children}</>;
}
