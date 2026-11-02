"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { signInWithOAuth } from "@/lib/auth/actions";

/**
 * Google sign-in.
 *
 * Google is the only OAuth provider the project enables — `oauthProviderSchema`
 * accepts nothing else, so rendering a second button would produce one that
 * cannot succeed. An Apple button lived here until the provider was confirmed
 * disabled in Supabase (`/auth/v1/settings` reports `apple: false`); it failed
 * closed and silently, resetting itself with nothing shown to the user, which
 * reads as a dead button rather than as unavailable. Adding a provider back
 * means enabling it in the hosted dashboard AND widening the schema, not just
 * restoring markup.
 *
 * The brand mark is inlined as SVG rather than pulled from an icon set: Google
 * requires its exact official mark and lucide has no equivalent. This is why
 * `GoogleMark` carries raw hex — a brand asset is not a themeable colour, so
 * `globals.css`'s "no hex in a component" rule does not reach it.
 *
 * A form POST to the server action keeps the redirect server-side, so the
 * provider URL and the state parameter never pass through client code.
 */
export interface OAuthButtonsProps {
  /** Relative path to return to after the round trip. */
  next?: string;
}

export function OAuthButtons({ next }: OAuthButtonsProps) {
  const t = useTranslations("auth.signIn");
  const [pending, setPending] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <form
        // Wrapped so the action returns void: signInWithOAuth resolves to an
        // ActionResult (on error) or redirects (on success), but a form
        // `action` must be void-returning. On error we release the button; on
        // success the redirect has already happened server-side.
        action={async (formData) => {
          const result = await signInWithOAuth(formData);
          if (!result.ok) setPending(false);
        }}
        onSubmit={() => setPending(true)}
      >
        <input type="hidden" name="provider" value="google" />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={pending}
        >
          <GoogleMark />
          {t("continueWithGoogle")}
        </Button>
      </form>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
      />
    </svg>
  );
}
