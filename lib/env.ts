import { z } from "zod";

/**
 * Environment validation.
 *
 * Split into two schemas on purpose — this is a security boundary, not a
 * stylistic one:
 *
 *   publicEnv — NEXT_PUBLIC_* only. Safe to reach the browser bundle.
 *   serverEnv — everything else, including the Supabase service-role key and
 *               the OpenAI key. Guarded by `server-only`, so importing it from
 *               a client component fails the build instead of leaking a secret.
 *
 * Both validate at module load and throw a message that names the offending
 * variable, so a misconfigured deploy dies at boot rather than at 2am inside a
 * request handler.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("must be a full URL, e.g. https://xxxx.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "must not be empty"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("must be a full URL, e.g. http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "must not be empty"),

  /** Project ref, used by the Supabase CLI scripts in package.json. */
  SUPABASE_PROJECT_REF: z.string().min(1, "must not be empty"),

  /**
   * Postgres connection string. Optional at runtime — the app talks to Supabase
   * over PostgREST, not directly — but required by `db:push` and `db:types`.
   */
  DATABASE_URL: z.string().min(1).optional(),

  /**
   * Required from P5 onward, when the LLM runner lands. Optional here so the
   * app boots for P1–P4 work without a key that nothing yet calls. Read it
   * through `requireOpenAIKey()` rather than directly, so the failure is loud
   * and specific at the point of use.
   */
  OPENAI_API_KEY: z.string().min(1).optional(),

  /**
   * Shared secret guarding POST /api/worker.
   *
   * That route runs with the service-role client and would otherwise be a
   * complete database bypass reachable by anyone on the internet. Optional in
   * the schema only so local `next dev` boots without it; the route itself
   * refuses every request when it is unset — see the comment there.
   */
  WORKER_SECRET: z
    .string()
    .min(16, "must be at least 16 characters")
    .optional(),

  /**
   * Contact address sent to Crossref/OpenAlex as the polite-pool `mailto`.
   *
   * This is a FIXED PROJECT address, never the student's email — it identifies
   * Scriptor to the provider so we get better rate limits, and it is the only
   * identity ever attached to a verification request. Optional at runtime; the
   * reference layer falls back to a hard-coded project contact when unset.
   */
  REFERENCE_VERIFICATION_MAILTO: z
    .string()
    .email("must be a valid email address")
    .optional(),

  /**
   * Optional Semantic Scholar API key. Without it the public, rate-limited pool
   * is used (and backed off on 429); with it, higher limits. Never required.
   */
  SEMANTIC_SCHOLAR_API_KEY: z.string().min(1).optional(),

  /**
   * Resend API key, for the transactional mail `notification_preferences`
   * already models — analysis complete, analysis failed, reference issues,
   * todo due soon, weekly digest.
   *
   * Optional in the schema and read through `requireResend()`, exactly like
   * OPENAI_API_KEY: nothing sends mail yet, and requiring it at boot would
   * break every environment that does not need it. The prefix check catches
   * the common paste error — supplying a Resend *domain id* (a bare UUID) or a
   * dashboard URL instead of the key, which would otherwise fail much later
   * with an opaque 401.
   */
  RESEND_API_KEY: z
    .string()
    .startsWith("re_", "must be a Resend API key beginning with re_")
    .optional(),

  /**
   * The From address on outgoing mail, e.g. `Scriptor <noreply@example.com>`.
   *
   * Separate from the key because Resend refuses to send from a domain that is
   * not verified on the account. Until a domain is added AND its DNS records
   * verify, the only usable value is `onboarding@resend.dev` — which delivers
   * ONLY to the address that owns the Resend account. Anything sent to a real
   * student from that sender is silently dropped, so this is worth stating
   * loudly rather than discovering in production.
   */
  RESEND_FROM: z.string().min(1).optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(scope: string, error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const name = issue.path.join(".");
    return `  - ${name}: ${issue.message}`;
  });

  return [
    `Invalid ${scope} environment configuration:`,
    ...lines,
    "",
    "Copy .env.example to .env.local and fill in the missing values.",
  ].join("\n");
}

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when accessed
 * as a full static member expression, so these cannot be read dynamically.
 */
const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsedPublic.success) {
  throw new Error(formatIssues("public", parsedPublic.error));
}

export const publicEnv: PublicEnv = parsedPublic.data;

/**
 * Reads and validates the server-only environment.
 *
 * Deliberately a function rather than a top-level constant: it is called from
 * `lib/supabase/admin.ts` and from server actions, which keeps the secret
 * schema out of any module graph that a client component could reach.
 * `lib/env.server.ts` carries the `server-only` guard.
 */
export function readServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    WORKER_SECRET: process.env.WORKER_SECRET,
    REFERENCE_VERIFICATION_MAILTO: process.env.REFERENCE_VERIFICATION_MAILTO,
    SEMANTIC_SCHOLAR_API_KEY: process.env.SEMANTIC_SCHOLAR_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    throw new Error(formatIssues("server", parsed.error));
  }

  return parsed.data;
}

/**
 * Returns the OpenAI key or throws with a message naming the variable.
 *
 * The key is optional in the schema because nothing calls the LLM until P5;
 * requiring it at boot would block every earlier prompt on a credential that is
 * not yet used. This accessor keeps the "fail loudly" guarantee by moving the
 * failure to the first call that actually needs it.
 */
export function requireOpenAIKey(env: ServerEnv): string {
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "Missing OPENAI_API_KEY. Add it to .env.local — see .env.example for where to get one.",
    );
  }
  return env.OPENAI_API_KEY;
}

/**
 * Returns the Resend credentials, or throws naming the missing variable.
 *
 * Same shape and same reasoning as `requireOpenAIKey`: optional at boot so an
 * environment that sends no mail still starts, loud at the first call that
 * actually needs it.
 *
 * Both values are returned together because neither is useful alone — a key
 * with no From address cannot send, and a From address with no key is inert.
 * Checking them at two different call sites is how one of them ends up
 * unvalidated.
 */
export function requireResend(env: ServerEnv): {
  apiKey: string;
  from: string;
} {
  if (!env.RESEND_API_KEY) {
    throw new Error(
      "Missing RESEND_API_KEY. Add it to .env — create one at https://resend.com/api-keys.",
    );
  }
  if (!env.RESEND_FROM) {
    throw new Error(
      "Missing RESEND_FROM. Set the sender, e.g. 'Scriptor <noreply@yourdomain.com>'. " +
        "Until a domain is verified on the Resend account the only working value is " +
        "'onboarding@resend.dev', which delivers only to the account owner.",
    );
  }
  return { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM };
}
