import * as React from "react";
import { redirect } from "next/navigation";

import { getSessionUser, hasRole } from "@/lib/auth/session";
import { ROUTES, type UserRole } from "@/lib/constants";
import type { AppRole } from "@/lib/db/enums";

/**
 * Role gate for the (admin) route group.
 *
 * P2 replaced the internals. Path and props are unchanged from P0.
 *
 * Defence in depth only. The authoritative control is RLS: an ADMIN-only table
 * is unreadable without the role regardless of which component rendered. This
 * gate exists so a non-admin gets a clean redirect instead of a page full of
 * empty result sets.
 */
export interface RequireRoleProps {
  children: React.ReactNode;
  role: UserRole;
  /** Rendered instead of children when the role does not match. */
  fallback?: React.ReactNode;
}

export async function RequireRole({
  children,
  role,
  fallback,
}: RequireRoleProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.signIn);
  }

  // UserRole and AppRole are the same members; ADMIN is the only gated one and
  // STUDENT has no admin counterpart in the database enum.
  if (role === "ADMIN" && !hasRole(user, "ADMIN" satisfies AppRole)) {
    if (fallback) return <>{fallback}</>;
    redirect(ROUTES.papers);
  }

  return <>{children}</>;
}
