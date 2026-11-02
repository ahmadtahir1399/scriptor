import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { sanitiseNextPath } from "@/lib/validations/auth";

/**
 * OAuth and magic-link redirect target.
 *
 * Deliberately at `/auth/callback`, OUTSIDE the `[locale]` segment. Supabase
 * matches redirect URLs against a fixed allowlist, and a locale-prefixed path
 * would produce a different URL per language — `/en/auth/callback` and
 * `/de/auth/callback` would each need their own entry, and the unprefixed
 * default locale would produce a third. `proxy.ts` excludes `/auth` from the
 * intl matcher for the same reason.
 *
 * ---------------------------------------------------------------------------
 * SETUP REQUIRED — this fails silently if skipped.
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
 *   http://localhost:3000/auth/callback
 *   https://<your-domain>/auth/callback
 * Without these, the provider redirects back and the exchange fails with an
 * unhelpful error that looks like a code bug.
 * ---------------------------------------------------------------------------
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  // Redirect against the CANONICAL site origin, never the request's own origin.
  // The request host is whatever the browser (or Supabase's redirect) happened
  // to use — which under Docker's `-H 0.0.0.0` bind can be `0.0.0.0:3000`, an
  // address browsers refuse to connect to (ERR_ADDRESS_INVALID). Pinning to
  // NEXT_PUBLIC_SITE_URL guarantees the user always lands on a routable origin.
  const origin = publicEnv.NEXT_PUBLIC_SITE_URL;

  const code = searchParams.get("code");
  // Sanitised even though we wrote it ourselves — it has round-tripped through
  // a third-party provider and comes back as untrusted input.
  const next = sanitiseNextPath(searchParams.get("next"));

  // The provider reports user-facing failures (consent denied, expired link)
  // here rather than by omitting the code.
  const providerError = searchParams.get("error");
  if (providerError) {
    console.error("[auth/callback] provider returned an error", {
      error: providerError,
      description: searchParams.get("error_description"),
    });
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] code exchange failed", error.message);
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
