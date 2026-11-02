/**
 * App-wide constants. Anything referenced by more than one prompt lives here so
 * later prompts never re-declare a magic string.
 *
 * Note: nothing user-facing belongs in this file — labels come from
 * `messages/{locale}.json`. What is stored here are route paths, storage keys
 * and enum-like unions.
 */

export const APP_NAME = "Scriptor" as const;

/** localStorage / cookie keys. Namespaced so they never collide. */
export const STORAGE_KEYS = {
  ui: "scriptor.ui",
  theme: "scriptor.theme",
} as const;

/** next-intl reads and writes this cookie when the locale switcher is used. */
export const LOCALE_COOKIE = "NEXT_LOCALE" as const;

/** One year, in seconds — the locale cookie's max-age. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  dashboard: "/dashboard",
  papers: "/papers",
  upload: "/upload",
  requirements: "/requirements",
  settings: "/settings",
  admin: "/admin",
  adminChecks: "/admin/checks",
  adminEvals: "/admin/evals",
  adminAnalyses: "/admin/analyses",
  adminUsers: "/admin/users",
} as const;

/**
 * Status of any long-running job in the app — a check, a generation, an
 * export. `StatusPill` renders exactly these four and nothing else, so P4, P6,
 * P9, P16 and P17 all speak the same language.
 */
export const JOB_STATUSES = ["NONE", "GENERATING", "DONE", "ERROR"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Roles. P2 populates the real value from the Supabase session. */
export const USER_ROLES = ["STUDENT", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Matches the `lg` breakpoint used to switch between the two shell layouts. */
export const DESKTOP_BREAKPOINT_PX = 1024;

/** Motion constants. Kept here so no component invents its own timing. */
export const MOTION = {
  duration: 0.2,
  durationQuick: 0.15,
  /** ease-out — deliberately not a spring. */
  ease: [0.16, 1, 0.3, 1],
  /** Content rises this far as it fades in. Never more. */
  riseY: 4,
} as const;

/**
 * Scroll-driven motion, for the marketing route group ONLY.
 *
 * These are deliberately here rather than in `globals.css`. That file owns
 * colour, radius and shadow — values the cascade applies. These are read by
 * JavaScript (Lenis config, ScrollTrigger scrub), and a token that has to be
 * fished back out with `getComputedStyle` is a token in the wrong place.
 *
 * `depth` is a multiplier on the scroll distance a drifting element travels.
 * Negative moves against the scroll, positive with it — that opposition is
 * what reads as depth. Keep the spread modest: past about 0.3 the parallax
 * stops looking like distance and starts looking like a bug.
 */
export const SCROLL = {
  /**
   * Lenis inertia. Lower is heavier. Note that Lenis ignores its `duration`
   * option entirely when `lerp` is set, so only one of the two is given here —
   * declaring both reads as configuration that is silently doing nothing.
   */
  lerp: 0.09,
  /** Seconds ScrollTrigger takes to catch up to the true scroll position. */
  scrub: 0.6,
  depth: {
    far: -0.26,
    mid: -0.14,
    near: 0.08,
    sink: 0.18,
  },
} as const;

export type DriftDepth = keyof typeof SCROLL.depth;
