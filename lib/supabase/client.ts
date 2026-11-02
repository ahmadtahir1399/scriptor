// BROWSER CLIENT — anon key, respects RLS.
// Use this in client components only. It carries the user's session from the
// auth cookie and can do nothing the user is not allowed to do.
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/db/types.generated";

/**
 * Creates the browser Supabase client.
 *
 * `createBrowserClient` memoises internally, so calling this per component is
 * cheap and correct — do not hoist it into a module-level singleton, which
 * would survive across users during development fast-refresh.
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
