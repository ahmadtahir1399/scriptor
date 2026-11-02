/**
 * Verdant Study, transcribed for email.
 *
 * ── WHY RAW HEX LIVES HERE, AND ONLY HERE ────────────────────────────────────
 *
 * CLAUDE.md says `app/globals.css` is the ONLY file where a raw colour may
 * appear, and that rule is right for the app: every component names a token and
 * the palette swap re-themed every screen at once.
 *
 * Email cannot participate in that. There is no cascade to inherit from, no
 * custom properties (Outlook's Word engine ignores `var()` entirely, and Gmail
 * strips `:root`), and no stylesheet — every declaration has to be an inline
 * `style` attribute holding a literal value, because Gmail for non-Gmail
 * accounts drops `<style>` blocks wholesale.
 *
 * So this file is the deliberate second home for the palette, and it is a
 * MIRROR, not a fork. Each value below carries the globals.css token it copies.
 * When a token changes there, change it here in the same commit — the app and
 * the mail it sends must not drift apart, and the templates import from here so
 * there is exactly one place to make that edit.
 *
 * Nothing else in the codebase may import this file for on-screen rendering.
 */

/** Light theme — mirrors the `@theme` block in `app/globals.css`. */
export const light = {
  /** --color-bg (linen) */
  bg: "#F1E9DD",
  /** --color-surface (card) */
  surface: "#FBF7F0",
  /** --color-border (hairline) */
  border: "#E1D5C4",
  /** --color-ink (espresso) — 12.59:1 on linen */
  ink: "#2A2521",
  /** --color-muted — safe everywhere */
  muted: "#635C51",

  /** --color-primary (pine). Brand and structure. NEVER a status signal. */
  primary: "#22392C",
  /** --color-primary-hover */
  primaryHover: "#2E4A38",
  /** --color-primary-soft (almond) */
  primarySoft: "#E6D6C3",
  /** --color-primary-foreground */
  primaryForeground: "#F1E9DD",

  /** --color-verified (sage-deep) */
  verified: "#3C5D46",
  verifiedSoft: "#E1EDE2",
  /** --color-warning (honey-ink) — raw honey is not text */
  warning: "#7A5E28",
  warningSoft: "#F6EBD8",
  /** --color-critical (clay) */
  critical: "#94553F",
  criticalSoft: "#F0E2DC",
  /** --color-ai (aubergine) — AI signal ONLY */
  ai: "#6B4A63",
  aiSoft: "#EFE3EB",

  /** --color-panel / --color-panel-deep — the pine panel gradient's two ends. */
  panel: "#22392C",
  panelDeep: "#1A2C22",
  panelForeground: "#F1E9DD",
  /** --color-panel-muted — secondary ink on pine, 6.35:1 */
  panelMuted: "#A8BFAE",
  /** A hairline that reads on pine — mirrors --color-sidebar-border. */
  panelBorder: "#33503E",

  /** --color-decor (honey). DECORATIVE ONLY: fills, rules, glows. Never text. */
  decor: "#BE9B5B",
  /** --color-green-300 (sage) — gauge tracks and chart lines. */
  sage: "#8AA891",
  /** --color-green-200 — sage at fill strength. */
  sageSoft: "#B7C9BB",
  /** --color-highlight (honey wash) — the same tint the PDF viewer uses. */
  highlight: "#F6E4B8",
} as const;

/**
 * Dark theme — mirrors the `.dark` block in `app/globals.css`.
 *
 * Applied through `@media (prefers-color-scheme: dark)`, which Apple Mail, iOS
 * Mail and Outlook for Mac honour. Gmail ignores it and instead force-inverts
 * some colours with its own algorithm; the layout is built so that a forced
 * inversion still lands on legible pairs rather than on ink-on-ink.
 *
 * Note the trap CLAUDE.md calls out, which applies here too: `primary` moves to
 * the LIGHT end in dark mode, but the panel stays a dark panel. `panel` is a
 * literal in both themes for exactly that reason — alias it to `primary` and
 * the header turns into a pale sage slab.
 */
export const dark = {
  bg: "#141C17",
  surface: "#1C2721",
  border: "#37423A",
  ink: "#EDE4D6",
  muted: "#A79B8A",

  primary: "#9CBBA5",
  primaryHover: "#B7C9BB",
  primarySoft: "#26332B",
  primaryForeground: "#14261B",

  verified: "#8FBF9C",
  verifiedSoft: "#1C2E22",
  warning: "#DDB877",
  warningSoft: "#33291A",
  critical: "#DB947B",
  criticalSoft: "#38231B",
  ai: "#C4A0BB",
  aiSoft: "#2C2230",

  panel: "#26352C",
  panelDeep: "#1B2620",
  panelForeground: "#EDE4D6",
  panelMuted: "#A8BFAE",
  panelBorder: "#3A4C40",

  decor: "#CBAB6E",
  sage: "#6B9078",
  sageSoft: "#3D5145",
  highlight: "#4E3D17",
} as const;

/**
 * ── THE THREE FACES, IN A MEDIUM THAT HAS NONE OF THEM ───────────────────────
 *
 * CLAUDE.md: Fraunces is our voice, Source Serif is the student's, Inter is the
 * chrome, and collapsing them "blurs whose words are on screen, which is the
 * point of a supervision tool". An email quoting a student's thesis back at them
 * has exactly that problem, so the distinction has to survive the trip.
 *
 * It cannot survive by webfont. Gmail, Outlook and Yahoo all refuse `@font-face`;
 * only Apple Mail and iOS honour it. So each face degrades to a DIFFERENT widely
 * installed fallback, chosen so the three stay visibly distinct even when not one
 * of the real faces loads:
 *
 *   display (Fraunces)      → Georgia          — high contrast, our voice
 *   serif   (Source Serif 4) → Palatino/Iowan   — humanist, calmer, theirs
 *   sans    (Inter)          → system UI stack  — chrome
 *
 * Georgia and Palatino are both near-universal (Palatino Linotype on Windows,
 * Palatino/Iowan Old Style on macOS and iOS) and read as clearly different
 * voices. Falling back to Georgia twice would merge the two serifs and lose the
 * one distinction this file exists to preserve.
 */
/**
 * ── THE QUOTES ARE SINGLE, AND THAT IS NOT A STYLE CHOICE ────────────────────
 *
 * A multi-word CSS family name has to be quoted, and these strings are
 * interpolated straight into HTML `style="…"` attributes — which are themselves
 * delimited by double quotes. Write `"Segoe UI"` here and the attribute
 * TERMINATES at that quote:
 *
 *     style="font-family:Fraunces, Georgia, "Times New Roman", Times, serif;
 *            font-size:27px;color:#2A2521;"
 *            ^ the attribute ends here ────┘
 *
 * The browser then keeps `font-family:Fraunces, Georgia,` (invalid, so it falls
 * back to the default serif) and parses the rest as stray attributes — so the
 * font-size, line-height and colour that FOLLOW font-family in the same
 * declaration are silently dropped too. Every heading rendered at the browser
 * default size in Times, which is exactly what it looked like before this was
 * caught.
 *
 * CSS accepts single-quoted family names identically, and a single quote cannot
 * close a double-quoted attribute. So: single quotes here, always. Do not
 * "tidy" them back to doubles.
 *
 * These strings must also never be passed through `esc()` — it would turn the
 * quotes into `&#39;` entities, which are not valid inside a CSS declaration.
 * They are trusted constants, not user input.
 */
export const font = {
  sans: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  display: `Fraunces, Georgia, 'Times New Roman', Times, serif`,
  serif: `'Source Serif 4', 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`,
} as const;

/**
 * The type scale, mirroring the `--text-*` steps in globals.css.
 *
 * Sizes are px strings because email clients handle `rem` inconsistently —
 * Outlook resolves it against its own root, not the document's.
 */
export const type = {
  pageTitle: { size: "27px", lineHeight: "34px", weight: "600" },
  sectionTitle: { size: "17px", lineHeight: "24px", weight: "600" },
  body: { size: "15px", lineHeight: "24px", weight: "400" },
  meta: { size: "13px", lineHeight: "20px", weight: "400" },
  micro: { size: "11px", lineHeight: "16px", weight: "600" },
} as const;

/** Mirrors --radius-md / --radius-lg. Ignored by Outlook, which squares them. */
export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  pill: "999px",
} as const;

/** The card's max width. 600px is the widest every client renders without scaling. */
export const CONTENT_WIDTH = 600;

export type Palette = typeof light;

/**
 * The four semantic tones, as a lookup.
 *
 * Same contract as `notificationTone()` in `lib/domain/notification.ts`:
 * `primary` is chrome, never state. A template picks a tone for its status pill
 * and the pill ALWAYS carries a text label — colour reinforces the word, it
 * never replaces it, because the status foregrounds are mutually ~1.2:1 and
 * nobody should be asked to tell them apart by hue.
 */
export type Tone = "primary" | "verified" | "warning" | "critical";

export function toneColors(
  tone: Tone,
  palette: Palette,
): { fg: string; soft: string } {
  switch (tone) {
    case "verified":
      return { fg: palette.verified, soft: palette.verifiedSoft };
    case "warning":
      return { fg: palette.warning, soft: palette.warningSoft };
    case "critical":
      return { fg: palette.critical, soft: palette.criticalSoft };
    case "primary":
      return { fg: palette.primary, soft: palette.primarySoft };
  }
}
