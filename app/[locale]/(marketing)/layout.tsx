import { getTranslations, setRequestLocale } from "next-intl/server";

import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { SmoothScroll } from "@/components/marketing/SmoothScroll";

/**
 * Chrome for the marketing route group.
 *
 * `SmoothScroll` lives here rather than in the root layout on purpose — see
 * the note in that file about the PDF viewer under `(app)`. Everything it
 * wraps is still server-rendered; it receives an already-rendered subtree.
 */
export default async function MarketingLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing.nav");

  return (
    <SmoothScroll>
      {/* Visible only on keyboard focus. A sticky header plus a long scroll
          page is exactly the layout that traps a keyboard user otherwise. */}
      <a
        href="#content"
        className="bg-surface text-ink focus-visible:ring-primary sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-60 focus:rounded-sm focus:px-4 focus:py-2.5 focus:text-[14px] focus-visible:ring-2 focus-visible:outline-none"
      >
        {t("skipToContent")}
      </a>

      <MarketingNav />
      <main id="content">{children}</main>
      <MarketingFooter />
    </SmoothScroll>
  );
}
