import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import { IconLeaf } from "@/components/icons";
import { IconMotion } from "@/components/motion/IconMotion";

/**
 * The marketing footer.
 *
 * Pine-deep rather than pine, so the page closes a step darker than it opened.
 * Intentionally sparse: there is no pricing, no blog and no social presence to
 * link, and a footer padded out with dead columns advertises that more loudly
 * than an honest short one does.
 */
export async function MarketingFooter() {
  const [t, tf] = await Promise.all([
    getTranslations("common"),
    getTranslations("landing.footer"),
  ]);

  const year = new Date().getFullYear();

  return (
    <footer className="bg-panel-deep">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-10 px-6 py-14 lg:flex-row lg:items-start lg:justify-between lg:px-10">
        <div className="max-w-[34ch]">
          {/* The last mark on the page draws itself as it arrives — the
              bookend to the one the hero opened with. Hover too, since the
              lockup is the only thing in this column worth reaching for. */}
          <div className="flex items-center gap-2.5">
            <IconMotion on={["view", "hover"]}>
              <IconLeaf className="text-panel-foreground size-6" />
            </IconMotion>
            <span className="display text-panel-foreground text-[19px] leading-none">
              {t("appName")}
            </span>
          </div>
          <p className="text-panel-muted mt-4 text-[13.5px] leading-relaxed">
            {tf("blurb")}
          </p>
        </div>

        <nav
          aria-label={tf("secondary")}
          className="flex flex-col gap-3 text-[13.5px]"
        >
          <a
            href="#checks"
            className="text-panel-muted hover:text-panel-foreground focus-visible:ring-decor rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {tf("checks")}
          </a>
          <Link
            href={ROUTES.signIn}
            className="text-panel-muted hover:text-panel-foreground focus-visible:ring-decor rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {tf("signIn")}
          </Link>
          <Link
            href={ROUTES.upload}
            className="text-panel-muted hover:text-panel-foreground focus-visible:ring-decor rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {tf("start")}
          </Link>
        </nav>
      </div>

      <div className="border-panel-foreground/10 border-t">
        <p className="text-panel-muted mx-auto w-full max-w-[1180px] px-6 py-6 text-[12.5px] lg:px-10">
          {tf("copyright", { year })}
        </p>
      </div>
    </footer>
  );
}
