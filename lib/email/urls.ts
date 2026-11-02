import { publicEnv } from "@/lib/env";

/**
 * Absolute URLs for email.
 *
 * Every link in an email must be absolute — there is no document base to
 * resolve against, so the relative hrefs the app uses everywhere else would
 * simply be dead. `NEXT_PUBLIC_SITE_URL` is already validated as a full URL by
 * the public schema in `lib/env.ts`, so this cannot silently produce `/papers`.
 *
 * Locale is deliberately omitted: the app's `[locale]` segment has a middleware
 * redirect that resolves an unprefixed path against the user's cookie and
 * profile preference. Baking `/en` into a link sent to a student who reads the
 * app in another language would override their own setting from their inbox.
 */
export function absoluteUrl(path: string): string {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export const emailUrls = {
  analysis: (analysisId: string) => absoluteUrl(`/analysis/${analysisId}`),
  analysisReferences: (analysisId: string) =>
    absoluteUrl(`/analysis/${analysisId}/references`),
  analysisTodos: (analysisId: string) =>
    absoluteUrl(`/analysis/${analysisId}/todos`),
  paper: (paperId: string) => absoluteUrl(`/papers/${paperId}`),
  papers: () => absoluteUrl("/papers"),
  /**
   * Account-level, NOT paper-level. `requirement_files` has no `paper_id` —
   * a guidelines document is extracted once and then applied to papers
   * individually through "Apply to a paper". Linking to a paper here would
   * take the student somewhere their new requirements are not yet visible.
   */
  requirements: () => absoluteUrl("/requirements"),
  upload: () => absoluteUrl("/upload"),
  dashboard: () => absoluteUrl("/dashboard"),
  notificationSettings: () => absoluteUrl("/settings#notifications"),
} as const;
