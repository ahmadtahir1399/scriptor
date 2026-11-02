import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUserRoles } from "@/lib/db/queries/identity";
import type { AppRole } from "@/lib/db/enums";

/**
 * Server-side session reading.
 *
 * `getSessionUser()` is wrapped in React's `cache()` so a request that checks
 * auth in a layout, again in a page, and again in a server action performs one
 * network round trip rather than three.
 */

export interface SessionUser {
  id: string;
  email: string;
  roles: AppRole[];
}

/**
 * Returns the authenticated user, or null.
 *
 * Uses `getClaims()`, NOT `getSession()` and no longer `getUser()`.
 *
 * `getSession()` would be wrong: it reads the cookie without verifying
 * anything, so its contents are whatever the client last sent — fine for
 * optimistic UI, unsafe for an authorisation decision.
 *
 * `getUser()` was correct but expensive: it validates by asking the auth
 * server, which is a network round trip on the critical path of every single
 * render. This project signs tokens with ES256 (asymmetric), so `getClaims()`
 * verifies the JWT signature locally against the cached JWKS and reaches the
 * same verdict with no round trip. It still calls `getSession()` internally
 * first, so an expired access token is refreshed exactly as before.
 *
 * The one behavioural difference: a token stays valid until it expires, so
 * revoking a user server-side takes effect at the next refresh rather than
 * instantly. RLS remains the authority underneath this for every actual read
 * and write, which is what bounds the exposure.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const { sub: id, email } = data.claims;
  if (typeof id !== "string" || typeof email !== "string" || !email)
    return null;

  const roles = await getUserRoles(supabase, id);

  return { id, email, roles };
});

/** True when the user holds the given role. */
export function hasRole(user: SessionUser | null, role: AppRole): boolean {
  return user?.roles.includes(role) ?? false;
}

/**
 * Returns the session user or throws.
 *
 * For server actions, where an unauthenticated caller is a programming error
 * rather than a state to render — the route protection in `proxy.ts` should
 * already have redirected them.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Not authenticated.");
  }
  return user;
}
