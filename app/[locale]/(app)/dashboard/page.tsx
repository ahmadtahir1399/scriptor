import * as React from "react";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { redirect } from "@/i18n/routing";
import { ROUTES } from "@/lib/constants";
import { getSessionUser } from "@/lib/auth/session";
import { getPapersLibrary } from "@/lib/papers/actions";
import { buildDashboard, timeOfDay } from "@/lib/dashboard/presentation";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

/**
 * The dashboard — what to work on next, and how the writing is progressing.
 *
 * A Server Component with NO client JavaScript of its own. Every animation on
 * this screen (the gauge draw, the chart draw, the stat count-ups, the
 * staggered entrances) is a CSS keyframe driven by an inline custom property,
 * so the app's landing screen costs nothing to hydrate. The only client leaf
 * below here is `StatusPill` in the recent list.
 *
 * It adds NO database round trips: `getPapersLibrary()` is the same read the
 * papers page performs and `buildDashboard` is pure derivation over it. With
 * the database in Tokyo, that restraint is worth more than any extra query.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect({ href: `${ROUTES.signIn}?next=/dashboard`, locale });
    return null;
  }

  const t = await getTranslations("dashboard");
  const format = await getFormatter();
  const papers = await getPapersLibrary();

  /*
   * The greeting and the date are resolved HERE, on the server, and passed
   * down. Deriving them in a client component would let the server and the
   * browser disagree across a midnight or timezone boundary — a hydration
   * mismatch on the largest words on the page.
   */
  const now = new Date();

  return (
    <DashboardContent
      view={buildDashboard(papers)}
      greeting={t(`greeting.${timeOfDay(now)}`)}
      today={format.dateTime(now, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    />
  );
}
