import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { MagicLinkNotice } from "@/components/auth/MagicLinkNotice";

/**
 * Magic-link confirmation screen.
 *
 * The email arrives as a query parameter rather than in a cookie or store so
 * the page survives a refresh — a student who reloads while switching to their
 * inbox must not lose their place. There is no code to enter: they click the
 * link in the email and land back on `/auth/callback`, which signs them in.
 */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { email } = await searchParams;

  // No email means the user landed here directly; there is nothing to confirm.
  if (!email) {
    redirect("/sign-in");
  }

  const t = await getTranslations("auth.verify");

  return (
    <Card>
      <CardContent className="p-8">
        <h1 className="text-page-title text-ink">{t("title")}</h1>
        <p className="text-body text-muted mt-1">{t("subtitle", { email })}</p>

        <div className="mt-6">
          <MagicLinkNotice email={email} />
        </div>
      </CardContent>
    </Card>
  );
}
