import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest config.
 *
 * `vite-tsconfig-paths` teaches the test runner the `@/*` alias from
 * tsconfig.json, so tests import exactly as the app does. Only the pure
 * library modules are tested here — `scoring.ts` and `resolveFindings.ts` have
 * no I/O and are the two places a silent bug would be most damaging.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["lib/**/__tests__/**/*.test.ts"],
    /*
     * Placeholder public env, so the suite is HERMETIC.
     *
     * `lib/env.ts` validates the public schema at module load and throws if it
     * is incomplete — so any test that reaches it transitively (the email
     * templates do, through `lib/email/urls.ts`, which needs a real base URL to
     * build absolute links) fails on import with an env error rather than an
     * assertion.
     *
     * These are deliberately fake and deliberately NOT read from `.env`. A
     * suite that loads the developer's real environment passes or fails
     * depending on whose machine it runs on, and would happily point a test at
     * a production Supabase project. Nothing here performs I/O; the values only
     * have to satisfy the schema, and the URL is what the link assertions see.
     */
    env: {
      NEXT_PUBLIC_SITE_URL: "https://scriptor.test",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
