// SERVER CLIENT — anon key, respects RLS, carries the user's session.
// Use this in server components, route handlers and server actions.
import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/db/types.generated";

/**
 * Creates a request-scoped Supabase client.
 *
 * Must be awaited per request — `cookies()` is async in Next 16 and the
 * returned store is tied to the current request, so a cached client would
 * serve one user's session to another.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a server component, where cookies are read-only.
            // Session refresh is handled in proxy.ts, so this is safe to skip.
          }
        },
      },
    },
  );
}
