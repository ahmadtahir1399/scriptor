import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { sanitiseNextPath } from "@/lib/validations/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SignInForm } from "@/components/auth/SignInForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

/**
 * Sign-in. Wrapped by the (auth) layout from P0, which supplies the wordmark
 * and the centred 400px column.
 */
export default async function SignInPage({
  params,
  searchParams,
}: {
  // Next 16: both are Promises and must be awaited.
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { next: rawNext } = await searchParams;
  // Sanitised at the boundary so nothing downstream handles a raw value.
  const next = rawNext ? sanitiseNextPath(rawNext) : undefined;

  const t = await getTranslations("auth.signIn");

  return (
    <Card>
      <CardContent className="p-8">
        <h1 className="display text-page-title text-ink">{t("title")}</h1>
        <p className="text-body text-muted mt-1">{t("subtitle")}</p>

        <div className="mt-6">
          <SignInForm next={next} />
        </div>

        <div className="relative my-6">
          <Separator />
          <span className="bg-surface text-meta text-muted absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3">
            {t("or")}
          </span>
        </div>

        <OAuthButtons next={next} />

        <p className="text-micro text-muted mt-6 text-center leading-relaxed normal-case tracking-normal">
          {t.rich("legal", {
            terms: (chunks: React.ReactNode) => (
              <Link
                href="/terms"
                className="hover:text-ink underline underline-offset-2"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks: React.ReactNode) => (
              <Link
                href="/privacy"
                className="hover:text-ink underline underline-offset-2"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </CardContent>
    </Card>
  );
}
