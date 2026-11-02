"use client";

/**
 * Re-export of the auth hook.
 *
 * `useAuth` is DEFINED in `providers/AuthProvider.tsx` and must stay there —
 * P0 fixed that path and every later prompt imports from it. This module
 * exists only because the P2 file list names it; it adds no behaviour and
 * holds no state of its own.
 *
 * Prefer importing from `@/providers/AuthProvider` directly.
 */
export { useAuth } from "@/providers/AuthProvider";
export type { AuthContextValue, AuthStatus, AuthUser } from "@/providers/AuthProvider";
