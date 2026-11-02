import { createServerClient } from "@supabase/ssr";
import createIntlProxy from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`. The exported
 * function must be named `proxy` (or be the default export); `middleware` is
 * deprecated and will not be picked up. Confirmed against
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 *
 * Two jobs, composed in this order:
 *
 *   1. next-intl resolves the locale and may rewrite or redirect.
 *   2. Supabase refreshes the auth token and writes updated cookies onto
 *      whatever response step 1 produced.
 *
 * Order matters, and so does what happens to the response afterwards. The intl
 * proxy returns a brand-new response object, and so does every
 * `NextResponse.redirect()` below — a refreshed auth cookie written onto a
 * response that is subsequently replaced is a silent sign-out. Every exit path
 * from this function therefore carries the Supabase cookies with it.
 */

const handleIntl = createIntlProxy(routing);

/** Path segments that require a session, checked after locale stripping. */
const PROTECTED_PREFIXES = [
  "/papers",
  "/upload",
  "/analysis",
  "/requirements",
  "/settings",
  "/admin",
];

/** Auth pages a signed-in user should not see. */
const AUTH_PREFIXES = ["/sign-in"];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`))
      return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/**
 * Moves every cookie written onto one response across to another.
 *
 * Needed because `NextResponse.redirect()` builds a BRAND-NEW response: any
 * `Set-Cookie` already written onto the response we were going to return is
 * silently dropped unless it is copied over. When the dropped cookie is a
 * freshly rotated Supabase refresh token, the browser keeps a token the auth
 * server has already retired — and the next request signs the user out.
 */
function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = handleIntl(request);

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          /*
           * Two destinations, and both are required.
           *
           * `request.cookies` is what gets forwarded to the server components
           * downstream; `response.cookies` is what the browser is told to
           * store. Writing only the latter leaves this request's own render
           * reading the stale, already-spent token.
           *
           * The intl response has to be rebuilt AFTER the request is mutated:
           * next-intl snapshots the request headers when it constructs its
           * rewrite, so a response made before this point still forwards the
           * old cookies no matter what we write here.
           */
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = handleIntl(request);

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  /*
   * getClaims() — not getSession(), and no longer getUser().
   *
   * This call is what refreshes an expired token and writes the new cookies
   * via setAll above: it calls getSession() internally, which performs the
   * refresh. getSession() alone would only read the cookie and would let
   * sessions quietly expire mid-visit.
   *
   * It also verifies the JWT, which matters because the redirect below is an
   * authorisation decision — but because this project signs with ES256, the
   * verification is a local signature check against the cached JWKS instead of
   * a network round trip to the auth server on every request. See the fuller
   * note in lib/auth/session.ts.
   */
  const { data, error } = await supabase.auth.getClaims();

  /*
   * A transport failure is not a verdict.
   *
   * getClaims() returns its error rather than throwing, so reading only `data`
   * makes a dropped fetch (AuthRetryableFetchError, status 0) look exactly like
   * "no session" — and a signed-in student gets bounced to /sign-in because one
   * request to Tokyo timed out. Worse, the bounce is sticky: the sign-in page
   * they land on then posts its Server Action into the redirect below.
   *
   * So when we could not decide, we do not decide. The request passes through
   * and `RequireAuth` in `(app)/layout.tsx` — with RLS underneath it — makes the
   * call on its own. Nothing protected is rendered on the strength of this
   * early return; it only forgoes the redirect.
   */
  if (error) {
    console.error(
      "[proxy] getClaims failed, skipping route gate",
      error.message,
    );
    return response;
  }

  const user = data?.claims ?? null;

  const path = stripLocale(request.nextUrl.pathname);

  /*
   * Both gates below are for NAVIGATIONS only.
   *
   * `NextResponse.redirect()` defaults to 307, which preserves the method and
   * the body. Redirecting a Server Action POST therefore sends nobody anywhere:
   * it re-posts the action, `Next-Action` header and all, to a page that does
   * not own it. Next then tries to forward the action to the page that does,
   * using that page's literal route pattern as a URL — it fetches
   * `/[locale]/sign-in`, which is not a path anything can serve, gets a 404, and
   * the browser surfaces "Failed to find Server Action". The action never runs
   * and the error names a deployment skew that did not happen.
   *
   * Actions do their own authorisation via `requireSessionUser()`, which is
   * where it belongs — a gate here could only ever corrupt them.
   */
  const isNavigation = request.method === "GET" || request.method === "HEAD";

  if (!isNavigation) {
    return response;
  }

  if (!user && PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    // Preserve where they were headed so sign-in can return them there.
    url.search = `?next=${encodeURIComponent(path)}`;
    return carryCookies(response, NextResponse.redirect(url));
  }

  if (user && AUTH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = "/papers";
    url.search = "";
    return carryCookies(response, NextResponse.redirect(url));
  }

  return response;
}

export const config = {
  /*
   * Everything except Next internals, the API surface and files with an
   * extension. `/auth/callback` is deliberately excluded via the `api|auth`
   * group: it is a fixed non-localised route and must not be rewritten by the
   * intl proxy, or the Supabase redirect allowlist will never match.
   */
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
