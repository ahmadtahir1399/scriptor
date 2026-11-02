import { CONTENT_WIDTH, font, light, radius, type, toneColors } from "@/lib/email/theme";
import type { Palette, Tone } from "@/lib/email/theme";

/**
 * The email design system — the shell and the pieces every template builds from.
 *
 * ── WHY THIS IS TABLES AND INLINE STYLES ─────────────────────────────────────
 *
 * None of the app's rendering assumptions hold in an inbox. Outlook 2016–2021 on
 * Windows renders with Word, which has no flexbox, no grid, no `border-radius`,
 * no `background-image` on a block, and no `max-width`. Gmail serving a non-Gmail
 * account (GANGA) strips `<head>` and every `<style>` in it. So:
 *
 *   - Structure is `<table>`, because it is the only box model shared by all of
 *     them.
 *   - Every visual declaration is an inline `style` attribute, so the mail is
 *     correct with the entire stylesheet thrown away.
 *   - The `<style>` block carries ONLY progressive enhancement — dark mode, the
 *     mobile breakpoint, the webfonts. Losing it costs polish, never legibility.
 *
 * ── ESCAPING IS LOAD-BEARING ─────────────────────────────────────────────────
 *
 * Paper titles, thesis excerpts and model-written finding text all flow into
 * these templates, and all three are attacker-influenceable: a student controls
 * the filename and the document body, and the document body is what the model
 * is quoting back. `esc()` is applied at every interpolation of untrusted text.
 * A raw `${}` of user content here is an HTML injection into someone's inbox.
 */

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

/** Escapes text for an HTML text node or a quoted attribute value. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escapes a URL for an `href`, refusing anything that is not http(s).
 *
 * Deep links are built from database values, and a `javascript:` or `data:` URL
 * reaching an `href` is a live payload in every webmail client that renders it.
 * An unusable URL degrades to the site root rather than shipping the string.
 */
export function escUrl(value: string): string {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return "#";
  return esc(trimmed);
}

/** Truncates on a word boundary, for titles and excerpts of unknown length. */
export function clamp(value: string, max: number): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------

export interface LayoutArgs {
  /** Sets `<title>`; also the accessible document name. */
  title: string;
  /**
   * The inbox preview line, shown next to the subject in every major client.
   *
   * Not optional in practice: with no preheader the client scrapes the first
   * text it finds, which is the wordmark, so every Scriptor email would preview
   * as the word "Scriptor". Write it as the second sentence of the subject.
   */
  preheader: string;
  /** Rendered inside the card. */
  body: string;
  /** Footer link back to notification settings. */
  settingsUrl: string;
  /** Optional line above the footer links, e.g. why this email was sent. */
  footerNote?: string;
}

/**
 * Wraps content in the Scriptor shell: pine masthead, linen ground, cream card.
 *
 * The three-layer nesting (ground table → card table → content table) is what
 * makes it centre in Outlook, which ignores `margin: 0 auto` on a block. The
 * fixed-width inner table inside a `role="presentation"` outer table is the only
 * centring that works everywhere.
 */
export function layout(args: LayoutArgs): string {
  const p = light;

  return `<!doctype html>
<html lang="en" dir="ltr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(args.title)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
${styleBlock()}
</head>
<body class="s-body" style="margin:0;padding:0;width:100%;background-color:${p.bg};-webkit-font-smoothing:antialiased;">
${preheader(args.preheader)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="s-ground" style="background-color:${p.bg};margin:0;padding:0;">
<tr><td align="center" style="padding:32px 12px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${CONTENT_WIDTH}" class="s-shell" style="width:${CONTENT_WIDTH}px;max-width:${CONTENT_WIDTH}px;">
${masthead()}
<tr><td class="s-card" style="background-color:${p.surface};border:1px solid ${p.border};border-top:0;border-radius:0 0 ${radius.lg} ${radius.lg};padding:32px;">
${args.body}
</td></tr>
${footer(args.settingsUrl, args.footerNote)}
</table>

</td></tr>
</table>
</body>
</html>`;
}

/**
 * Hidden inbox preview text.
 *
 * The trailing zero-width joiners are the standard trick: without them Gmail
 * pads the preview with the next thing it can read, which is the masthead, so
 * the preview becomes "…your review is ready Scriptor Scriptor Scriptor".
 */
function preheader(text: string): string {
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(
    text,
  )}${"&#8204;&nbsp;".repeat(60)}</div>`;
}

/**
 * The pine masthead.
 *
 * Mirrors `.pine-panel`: a pine-to-pine-deep gradient with a honey rule beneath
 * it. Outlook cannot render the CSS gradient, so `bgcolor` carries the flat pine
 * underneath and the gradient is a pure enhancement — the panel is a panel in
 * every client, and a gradient panel in most.
 *
 * Honey is `decor`: 4.75:1 on pine, and used here as a 3px RULE, never as text.
 */
function masthead(): string {
  const p = light;
  return `<tr><td class="s-masthead" bgcolor="${p.panel}" style="background-color:${p.panel};background-image:linear-gradient(160deg, ${p.panel} 0%, ${p.panelDeep} 100%);border-radius:${radius.lg} ${radius.lg} 0 0;padding:26px 32px 22px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td align="left" style="font-family:${font.display};font-size:20px;line-height:26px;font-weight:600;letter-spacing:-0.01em;color:${p.panelForeground};">Scriptor</td>
<td align="right" style="font-family:${font.sans};font-size:11px;line-height:16px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${p.panelMuted};">Thesis review</td>
</tr>
</table>
</td></tr>
<tr><td style="font-size:0;line-height:0;height:3px;background-color:${p.decor};">&nbsp;</td></tr>`;
}

function footer(settingsUrl: string, note?: string): string {
  const p = light;
  return `<tr><td class="s-footer" style="padding:22px 32px 0;font-family:${font.sans};font-size:12px;line-height:19px;color:${p.muted};">
${note ? `<p class="s-muted" style="margin:0 0 10px;color:${p.muted};">${esc(note)}</p>` : ""}
<p class="s-muted" style="margin:0 0 6px;color:${p.muted};">You're receiving this because you asked Scriptor to review a document. <a class="s-link" href="${escUrl(
    settingsUrl,
  )}" style="color:${p.primary};text-decoration:underline;">Change what we email you</a>.</p>
<p class="s-muted" style="margin:0;color:${p.muted};">Scriptor — supervision for your thesis.</p>
</td></tr>`;
}

/**
 * Progressive enhancement only: webfonts, dark mode, the mobile breakpoint.
 *
 * Everything here is expendable. Gmail-for-other-accounts drops this entire
 * block, and the inline styles alone still produce the light-mode design at full
 * fidelity — that is the test any rule added here must pass.
 */
function styleBlock(): string {
  const d = {
    bg: "#141C17",
    surface: "#1C2721",
    border: "#37423A",
    ink: "#EDE4D6",
    muted: "#A79B8A",
    primary: "#9CBBA5",
    panel: "#26352C",
  };

  return `<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400&display=swap');

/* Outlook renders the fallback; this keeps it from substituting a third face. */
body, table, td, p, a, span { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table { border-collapse:collapse !important; }
img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
a { text-decoration:underline; }

/* Gmail and Outlook.com both re-colour unstyled links to their own blue. */
a[x-apple-data-detectors], .unstyle-auto-detected-links a, .aBn {
  color:inherit !important; text-decoration:none !important; font-size:inherit !important;
  font-family:inherit !important; font-weight:inherit !important; line-height:inherit !important;
}

@media only screen and (max-width:620px) {
  .s-shell { width:100% !important; max-width:100% !important; }
  .s-card, .s-masthead, .s-footer { padding-left:20px !important; padding-right:20px !important; }
  .s-title { font-size:23px !important; line-height:29px !important; }
  .s-score-num { font-size:52px !important; line-height:56px !important; }
  /* The stat row is a single table row; on a phone the three cells would each
     be ~60px wide. Forcing them to stack is the one layout change we make. */
  .s-stat { display:block !important; width:100% !important; padding:0 0 14px !important; }
}

@media (prefers-color-scheme: dark) {
  /* The BODY as well as the ground table. The ground is only as tall as its
     content, so on a short email — the failure and incompatible ones — the
     body shows below it. Without this the dark card sits on a strip of light
     linen, which reads as a broken template rather than a light-mode email. */
  .s-body { background-color:${d.bg} !important; }
  .s-ground { background-color:${d.bg} !important; }
  .s-card { background-color:${d.surface} !important; border-color:${d.border} !important; }
  .s-masthead { background-color:${d.panel} !important; background-image:linear-gradient(160deg, ${d.panel} 0%, #1B2620 100%) !important; }
  .s-ink { color:${d.ink} !important; }
  .s-muted { color:${d.muted} !important; }
  .s-link { color:${d.primary} !important; }
  .s-rule { border-color:${d.border} !important; }
  .s-well { background-color:#141C17 !important; border-color:${d.border} !important; }
  /* Status pills: the soft grounds invert with the ramp, the foregrounds move
     to the light end. Both pairs are the .dark values from globals.css. */
  .s-pill-verified { background-color:#1C2E22 !important; color:#8FBF9C !important; }
  .s-pill-warning  { background-color:#33291A !important; color:#DDB877 !important; }
  .s-pill-critical { background-color:#38231B !important; color:#DB947B !important; }
  .s-pill-primary  { background-color:#26332B !important; color:#9CBBA5 !important; }
  .s-accent-verified { border-color:#8FBF9C !important; }
  .s-accent-warning  { border-color:#DDB877 !important; }
  .s-accent-critical { border-color:#DB947B !important; }
  .s-accent-primary  { border-color:#9CBBA5 !important; }
  .s-track { background-color:#37423A !important; }
}
</style>`;
}

// ---------------------------------------------------------------------------
// Content primitives
// ---------------------------------------------------------------------------

/** The page title. Fraunces, via the display stack — our voice, not the student's. */
export function title(text: string): string {
  return `<h1 class="s-title s-ink" style="margin:0 0 12px;font-family:${font.display};font-size:${type.pageTitle.size};line-height:${type.pageTitle.lineHeight};font-weight:600;letter-spacing:-0.02em;color:${light.ink};">${esc(
    text,
  )}</h1>`;
}

/** Body copy. Inter — chrome and explanation, never the student's own words. */
export function paragraph(html: string, marginBottom = 16): string {
  return `<p class="s-ink" style="margin:0 0 ${marginBottom}px;font-family:${font.sans};font-size:${type.body.size};line-height:${type.body.lineHeight};color:${light.ink};">${html}</p>`;
}

export function lead(html: string): string {
  return `<p class="s-muted" style="margin:0 0 24px;font-family:${font.sans};font-size:16px;line-height:26px;color:${light.muted};">${html}</p>`;
}

export function meta(text: string): string {
  return `<p class="s-muted" style="margin:0 0 20px;font-family:${font.sans};font-size:${type.meta.size};line-height:${type.meta.lineHeight};color:${light.muted};">${esc(
    text,
  )}</p>`;
}

/**
 * A status pill: soft ground, tone foreground, and ALWAYS a text label.
 *
 * This is the semantic contract from CLAUDE.md rendered for email. The status
 * foregrounds are mutually ~1.2:1, which is fine precisely because the word
 * carries the meaning and the colour only reinforces it. A pill with no label,
 * or a pill in `primary` used to mean "passed", breaks the contract.
 *
 * Built as a one-cell table rather than a styled `<span>` because Outlook drops
 * padding on inline elements, which would collapse the pill onto its text.
 */
export function pill(label: string, tone: Tone): string {
  const c = toneColors(tone, light);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr>
<td class="s-pill-${tone}" style="background-color:${c.soft};border-radius:${radius.pill};padding:6px 14px;font-family:${font.sans};font-size:${type.micro.size};line-height:${type.micro.lineHeight};font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:${c.fg};white-space:nowrap;">${esc(
    label,
  )}</td>
</tr></table>`;
}

/**
 * The score plate — the completion email's centrepiece.
 *
 * The app draws an SVG arc (`.arc-draw`). Email cannot: Gmail strips `<svg>`
 * entirely and Outlook never supported it, so an arc would be a blank hole in
 * the two clients most people read mail in. Rendering it server-side as a PNG
 * was the other option and was rejected — images are blocked by default in
 * Outlook and by many Gmail users, which puts the single most important number
 * in the email behind a "download pictures" prompt.
 *
 * So the gauge becomes a SEGMENTED METER: ten table cells, filled to the score.
 * It is nothing but `<td bgcolor>`, so it renders identically everywhere, with
 * images off, and at any zoom. The number itself is live text in the display
 * face at 64px — readable before the meter is even parsed.
 *
 * The meter is not the only carrier of the value: the numeral states it, and the
 * band label beneath states it in words. Same rule as the app — colour and
 * geometry reinforce a label, they never replace it.
 */
export function scorePlate(args: {
  score: number;
  bandLabel: string;
  tone: Tone;
  caption: string;
}): string {
  const p = light;
  // NOTE: `args.tone` is intentionally not turned into a colour here. Nothing
  // inside the pine plate is tinted by it — the meter is honey (the only decor
  // that clears 4.75:1 on pine) and the band name is plain panel text. The tone
  // travels with the pill and the accent rows on the card instead, where the
  // status foregrounds actually meet contrast against linen.
  const clamped = Math.max(0, Math.min(100, Math.round(args.score)));
  const filled = Math.round(clamped / 10);

  const cells = Array.from({ length: 10 }, (_, i) => {
    const on = i < filled;
    // Honey, not the tone colour, for the filled run: this sits on pine, where
    // decor is 4.75:1 and the status greens are not. The tone is carried by the
    // band label below, which sits on the card.
    const bg = on ? p.decor : p.panelBorder;
    return `<td class="${on ? "" : "s-track"}" width="10%" style="background-color:${bg};font-size:0;line-height:0;height:8px;border-radius:2px;">&nbsp;</td>${
      i < 9 ? `<td width="1%" style="font-size:0;line-height:0;">&nbsp;</td>` : ""
    }`;
  }).join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 26px;">
<tr><td bgcolor="${p.panel}" class="s-masthead" style="background-color:${p.panel};background-image:linear-gradient(150deg, ${p.panel} 0%, ${p.panelDeep} 100%);border-radius:${radius.md};padding:28px 28px 24px;">

<p style="margin:0 0 4px;font-family:${font.sans};font-size:11px;line-height:16px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:${p.panelMuted};">Overall score</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="s-score-num" style="font-family:${font.display};font-size:64px;line-height:66px;font-weight:600;letter-spacing:-0.03em;color:${p.panelForeground};padding:0;">${clamped}</td>
<td valign="bottom" style="padding:0 0 12px 6px;font-family:${font.display};font-size:22px;line-height:24px;font-weight:600;color:${p.panelMuted};">/100</td>
</tr></table>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;"><tr>${cells}</tr></table>

<p style="margin:16px 0 0;font-family:${font.sans};font-size:13px;line-height:20px;color:${p.panelForeground};"><strong style="font-weight:600;">${esc(
    args.bandLabel,
  )}</strong> <span style="color:${p.panelMuted};">— ${esc(args.caption)}</span></p>

</td></tr></table>`;
}

/**
 * A three-across stat row. Collapses to stacked blocks under 620px.
 *
 * Numbers are in the display face, matching the app's stat cards; labels are in
 * Inter. `mso-hide` is not needed here because the row degrades gracefully —
 * Outlook simply keeps all three side by side, which is the desktop layout.
 */
export function statRow(
  stats: ReadonlyArray<{ value: string; label: string; tone?: Tone }>,
): string {
  const p = light;
  const cells = stats
    .map((stat) => {
      const colour = stat.tone ? toneColors(stat.tone, p).fg : p.ink;
      const cls = stat.tone ? "" : "s-ink";
      return `<td class="s-stat" width="${Math.floor(
        100 / stats.length,
      )}%" valign="top" style="padding:0 10px 0 0;">
<p class="${cls}" style="margin:0 0 2px;font-family:${font.display};font-size:30px;line-height:34px;font-weight:600;letter-spacing:-0.02em;color:${colour};">${esc(
        stat.value,
      )}</p>
<p class="s-muted" style="margin:0;font-family:${font.sans};font-size:12px;line-height:17px;color:${p.muted};">${esc(
        stat.label,
      )}</p>
</td>`;
    })
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 26px;"><tr>${cells}</tr></table>`;
}

/**
 * A finding or task row: solid tone left border, label, detail.
 *
 * The solid `verified`/`warning`/`critical` fill is used exactly as the contract
 * permits — a thin accent sitting beside a text label that already says which
 * state it is.
 */
export function accentRow(args: {
  tone: Tone;
  label: string;
  title: string;
  detail?: string;
}): string {
  const p = light;
  const c = toneColors(args.tone, p);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 10px;">
<tr><td class="s-accent-${args.tone} s-well" style="border-left:3px solid ${c.fg};background-color:${p.bg};border-radius:0 ${radius.sm} ${radius.sm} 0;padding:12px 16px;">
<p class="s-pill-${args.tone}" style="margin:0 0 3px;font-family:${font.sans};font-size:11px;line-height:16px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:${c.fg};background-color:transparent;">${esc(
    args.label,
  )}</p>
<p class="s-ink" style="margin:0;font-family:${font.sans};font-size:14px;line-height:21px;font-weight:500;color:${p.ink};">${esc(
    args.title,
  )}</p>
${
  args.detail
    ? `<p class="s-muted" style="margin:4px 0 0;font-family:${font.sans};font-size:13px;line-height:20px;color:${p.muted};">${esc(
        args.detail,
      )}</p>`
    : ""
}
</td></tr></table>`;
}

/**
 * The student's own writing, quoted back.
 *
 * Source Serif via the serif stack, mirroring `.prose-thesis`, with a honey rule
 * on the left. This is the one place in the email where a different voice speaks,
 * and keeping it typographically separate from the Fraunces headings is the
 * whole reason `font.serif` and `font.display` fall back to different faces.
 */
export function excerpt(text: string, pageLabel?: string): string {
  const p = light;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">
<tr><td style="border-left:3px solid ${p.decor};padding:2px 0 2px 16px;">
<p class="s-ink" style="margin:0;font-family:${font.serif};font-size:15px;line-height:25px;color:${p.ink};">“${esc(
    text,
  )}”</p>
${
  pageLabel
    ? `<p class="s-muted" style="margin:6px 0 0;font-family:${font.sans};font-size:12px;line-height:17px;color:${p.muted};">${esc(
        pageLabel,
      )}</p>`
    : ""
}
</td></tr></table>`;
}

/**
 * The primary call to action.
 *
 * The VML block is what makes it a solid pine button in Outlook for Windows,
 * where the `<a>` would otherwise render as bare underlined text on no
 * background. `arcsize` is a percentage of height, so it tracks the 44px box —
 * which is also the minimum comfortable tap target, and the reason the height is
 * not smaller.
 *
 * `width` has to be declared for VML, so it is estimated from the label. The
 * estimate only affects Outlook, and over-wide is harmless where under-wide
 * would clip.
 */
export function button(label: string, url: string): string {
  const p = light;
  const href = escUrl(url);
  const width = Math.max(180, Math.min(320, label.length * 10 + 56));

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;"><tr><td>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:${width}px;" arcsize="23%" stroke="f" fillcolor="${p.primary}">
<w:anchorlock/>
<center style="color:${p.primaryForeground};font-family:${font.sans};font-size:15px;font-weight:600;">${esc(
    label,
  )}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${href}" style="display:inline-block;background-color:${p.primary};color:${p.primaryForeground};font-family:${font.sans};font-size:15px;line-height:20px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:${radius.md};mso-hide:all;">${esc(
    label,
  )}</a>
<!--<![endif]-->
</td></tr></table>`;
}

/** A secondary, quieter link under the button. */
export function textLink(label: string, url: string): string {
  return `<p style="margin:0 0 20px;font-family:${font.sans};font-size:${type.meta.size};line-height:${type.meta.lineHeight};"><a class="s-link" href="${escUrl(
    url,
  )}" style="color:${light.primary};text-decoration:underline;">${esc(label)}</a></p>`;
}

/** A hairline. `border-top` on a spacer cell — Outlook ignores `<hr>` styling. */
export function rule(marginTop = 8, marginBottom = 24): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:${marginTop}px 0 ${marginBottom}px;"><tr><td class="s-rule" style="border-top:1px solid ${light.border};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`;
}

/** A small uppercase section heading. */
export function sectionLabel(text: string): string {
  return `<p class="s-muted" style="margin:0 0 12px;font-family:${font.sans};font-size:11px;line-height:16px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:${light.muted};">${esc(
    text,
  )}</p>`;
}

/** A quiet well for supporting detail — error text, next steps, digest rows. */
export function well(inner: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;">
<tr><td class="s-well" style="background-color:${light.bg};border:1px solid ${light.border};border-radius:${radius.md};padding:18px 20px;">${inner}</td></tr>
</table>`;
}

/** Bold, in ink. Kept here so templates never hand-write a colour. */
export function strong(text: string): string {
  return `<strong style="font-weight:600;color:${light.ink};">${esc(text)}</strong>`;
}

export type { Palette, Tone };
