import { z } from "zod";

/** Auth form and action input schemas. */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "required")
  .email("enter a valid email address")
  // Normalise so the rate-limit hash and the Supabase identity agree on case.
  .transform((value) => value.toLowerCase());

export const signInSchema = z.object({
  email: emailSchema,
});
export type SignInInput = z.infer<typeof signInSchema>;

export const verifyOtpSchema = z.object({
  email: emailSchema,
  token: z
    .string()
    .trim()
    .length(6, "enter all six digits")
    .regex(/^\d{6}$/, "digits only"),
  next: z.string().optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/*
 * Google only. This is an allowlist, not a description of what Supabase
 * supports: `provider` arrives from a form field and reaches
 * `supabase.auth.signInWithOAuth`, so anything accepted here is a provider a
 * caller can ask the server to start a redirect to. Widen it only alongside
 * enabling that provider in the hosted dashboard.
 */
export const oauthProviderSchema = z.enum(["google"]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

/**
 * Open-redirect guard.
 *
 * A `next` parameter arrives from the URL and is therefore attacker-controlled.
 * Only same-site relative paths are accepted:
 *
 *   "/papers"           → allowed
 *   "//evil.com"        → rejected (protocol-relative, browsers treat as absolute)
 *   "https://evil.com"  → rejected
 *   "/\evil.com"        → rejected (backslash is normalised to "/" by some browsers)
 *
 * Anything rejected falls back to the caller's default rather than erroring —
 * a bad redirect target should not block a legitimate sign-in.
 */
export function sanitiseNextPath(
  next: string | null | undefined,
  fallback = "/papers",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.startsWith("/\\")) return fallback;
  if (next.includes("\\")) return fallback;
  return next;
}
