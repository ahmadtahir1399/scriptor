import * as React from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { IconLeaf } from "@/components/icons";

/**
 * Auth shell — sign in, sign up, password reset (P2 builds the pages).
 *
 * A single centred column on the linen ground. No sidebar and no topbar:
 * there is nothing to navigate to until the user is signed in, and a bare
 * screen keeps the focus on the one action available.
 *
 * The pine hero belongs to the landing page; this is the calm after it. The
 * only brand element is the leaf, and the only motion is one soft rise — a
 * screen the user reaches while slightly anxious is not the place to perform.
 */
export default async function AuthLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("common");

  return (
    <div className="bg-bg flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="rise mb-8 flex flex-col items-center text-center">
        <IconLeaf className="text-primary mb-3 size-8" />
        <p className="display text-ink text-[22px] leading-none">
          {t("appName")}
        </p>
        <p className="text-meta text-muted mt-2">{t("tagline")}</p>
      </div>

      <div
        className="rise w-full max-w-[400px]"
        style={{ "--rise-delay": "80ms" } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
