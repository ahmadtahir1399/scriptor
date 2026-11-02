import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { IconAlert } from "@/components/icons";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Terminal page for a failed auth exchange.
 *
 * Outside `[locale]`, matching the callback route it partners, so it resolves
 * whatever the redirect allowlist points at. Copy is loaded with the default
 * locale because there is no locale segment to read here.
 *
 * THIS IS THE ONE PLACE `next/link` IS CORRECT. The app-wide rule is to import
 * `Link` from `@/i18n/routing`, but that Link is a client component that needs
 * `NextIntlClientProvider` — which only exists inside `[locale]`. Using it here
 * throws "No intl context found" and takes the page down. `ButtonLink` wraps
 * that same Link, so it cannot be used here either; the styles come straight
 * from `buttonVariants` instead.
 */
export default async function AuthCodeErrorPage() {
  const t = await getTranslations({
    locale: "en",
    namespace: "auth.callbackError",
  });

  return (
    <div className="bg-bg flex min-h-dvh items-center justify-center px-6 py-12">
      <Card className="w-full max-w-[400px]">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="bg-critical-soft flex size-12 items-center justify-center rounded-full">
            <IconAlert
              className="text-critical size-5"
              aria-hidden="true"
            />
          </div>

          <h1 className="display text-section-title text-ink mt-4">
            {t("title")}
          </h1>
          <p className="text-body text-muted mt-2">{t("description")}</p>

          <Link
            href="/sign-in"
            className={buttonVariants({ className: "mt-6 w-full" })}
          >
            {t("action")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
