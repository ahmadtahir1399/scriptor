// SERVICE ROLE — bypasses RLS. Server-only. Never import into a client component.
import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/db/types.generated";

/**
 * Service-role Supabase client.
 *
 * This client sees and can modify every row belonging to every user. There is
 * no session and no policy enforcement — authorisation is entirely your
 * responsibility at the call site. Reach for `lib/supabase/server.ts` first;
 * use this only for genuine cross-user work (admin dashboards, background
 * jobs, webhooks).
 *
 * The `server-only` import above turns an accidental client import into a
 * build error rather than a leaked key.
 */
export function createAdminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
