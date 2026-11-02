import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Per-request i18n config consumed by the next-intl plugin.
 *
 * Default export is required by `getRequestConfig` — this is the one file in
 * the codebase exempt from the named-exports-only rule, because the framework
 * resolves it by module identity rather than by name.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)) as {
    default: Record<string, unknown>;
  };

  return {
    locale,
    messages: messages.default,
    /*
     * A single reference point for every `format.relativeTime` call.
     *
     * Without it next-intl falls back to "now at the moment of the call" and
     * warns (ENVIRONMENT_FALLBACK) — which is not merely noisy. The server
     * renders "2 minutes ago" against one clock and the client re-renders it
     * against another, so any timestamp near a unit boundary produces a
     * hydration mismatch that React cannot patch up. Pinning it per request
     * means both passes format from the same instant and agree.
     */
    now: new Date(),
  };
});
