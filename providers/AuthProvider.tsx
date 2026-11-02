"use client";

import * as React from "react";

import type { UserRole } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

/**
 * Auth context.
 *
 * P2 replaced the internals of this file. The module path, the context shape
 * and the `useAuth()` signature are unchanged from P0 — every prompt from here
 * to P17 imports `useAuth` from this exact path, so it must not move.
 *
 * The server resolves the session and passes it as `initialUser`, so the first
 * client render already knows who the user is and no auth-dependent UI flashes
 * a signed-out state. `onAuthStateChange` then keeps it live for token refresh
 * and sign-out in another tab.
 */

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const [user, setUser] = React.useState<AuthUser | null>(initialUser);
  // Only "loading" when the server gave us nothing to start from.
  const [status, setStatus] = React.useState<AuthStatus>(
    initialUser ? "authenticated" : "loading",
  );

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Resolve once on mount so a client-only navigation still settles, then
    // keep in sync. getUser() validates against the auth server rather than
    // trusting the cookie.
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const authUser = data.user;
      const email = authUser?.email;
      if (authUser && email) {
        setUser((previous) => ({
          // Role comes from the server via initialUser; the client cannot read
          // user_roles for anyone and must not invent a value here.
          role: previous?.role ?? "STUDENT",
          id: authUser.id,
          // Captured after the guard so it is narrowed to string inside this
          // closure, where TS would otherwise re-widen authUser.email.
          email,
        }));
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "SIGNED_OUT" || !session?.user?.email) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      setUser((previous) => ({
        role: previous?.role ?? "STUDENT",
        id: session.user.id,
        email: session.user.email ?? "",
      }));
      setStatus("authenticated");
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = React.useCallback(async (): Promise<void> => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setStatus("unauthenticated");
    // Full reload rather than a router push: it clears every cached server
    // component payload, so no page keeps rendering the previous user's data.
    window.location.assign("/sign-in");
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated" && user !== null,
      signOut,
    }),
    [user, status, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads the auth context. Throws outside the provider — a loud failure beats a
 * component silently believing nobody is signed in.
 */
export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return context;
}
