import * as React from "react";

import { Icon, Seed, Stroke, type IconProps } from "@/components/icons/Icon";

/**
 * The Scriptor icon set.
 *
 * Read the contract in `Icon.tsx` before adding one. The short version: 24
 * grid, 1.6 stroke, round terminals, curves over straights, and one filled
 * `<Seed>` marking the icon's live point.
 *
 * Named by ROLE, not by shape — `IconLibrary`, not `IconStackOfPaper`. A
 * rename of the drawing then never touches a call site.
 */

export type { IconProps };

/* ── Brand ─────────────────────────────────────────────────────────────── */

/**
 * The leaf. Blade plus a midrib that overshoots into a writing stroke — the
 * whole product in one glyph: something growing, and something written.
 */
export function IconLeaf({ ...props }: IconProps) {
  return (
    <Icon glyph="leaf" {...props}>
      <Stroke d="M20 3.6c0 8.4-4.8 13.4-11.6 14C5 17.9 3 15.2 3 11.9 3 7 7.5 3.6 13.7 3.6H20Z" />
      <Stroke d="M18.9 4.7C13.7 8.4 9.9 12.9 7.4 21" />
    </Icon>
  );
}

/* ── Navigation ────────────────────────────────────────────────────────── */

/**
 * Dashboard — the screen itself, not an abstraction of it.
 *
 * Four empty rounded squares are the icon every product ships, and they say
 * "grid" rather than "your work, measured". This is the app's own dashboard in
 * miniature: a header strip, a rail, the list of papers down the left with the
 * current one seeded, and the score trend climbing across the panel.
 */
export function IconDashboard({ ...props }: IconProps) {
  return (
    <Icon glyph="dashboard" {...props}>
      <Stroke d="M3.4 6.6c0-1.77 1.43-3.2 3.2-3.2h10.8c1.77 0 3.2 1.43 3.2 3.2v10.8c0 1.77-1.43 3.2-3.2 3.2H6.6c-1.77 0-3.2-1.43-3.2-3.2Z" />
      <Stroke d="M3.4 8.9h17.2" />
      <Stroke d="M9.5 8.9v11.7" />
      <Stroke d="M5.8 12.6h1.9" />
      <Stroke d="M5.8 15.6h1.9" />
      <Stroke
        accent
        d="M11.9 17.4c1.3 0 1.9-2.7 3.2-2.7 1 0 1.4 1.2 2.2 1.2.9 0 1.5-1 2.1-2.7"
      />
      <Seed cx={6.75} cy={18.6} r={0.9} />
    </Icon>
  );
}

/**
 * Papers — leaves of a document, the top one lifted like a page turning.
 *
 * The page now has something ON it: three findings against three lines. An
 * empty sheet is a file; a sheet with marked-up lines is a supervised draft,
 * which is what this app holds.
 *
 * Three seeds rather than the usual one. The set's signature is a single dot
 * marking a glyph's live point, and this is the second deliberate exception
 * after `IconMore` — here the repetition IS the subject, and each dot lands in
 * turn under the draw, so the row reads as a list assembling.
 */
export function IconLibrary({ ...props }: IconProps) {
  return (
    <Icon glyph="library" {...props}>
      <Stroke d="M7.5 6.2c0-1.2.9-2.2 2.1-2.2h4.6L19 8.4v9.4c0 1.2-.9 2.2-2.1 2.2H9.6c-1.2 0-2.1-1-2.1-2.2Z" />
      <Stroke d="M13.9 4v3.1c0 .8.6 1.4 1.4 1.4H19" />
      <Stroke d="M4.6 8.3v9.1C4.6 19.1 6 20.5 7.7 20.5" />
      <Stroke d="M12.4 12.4h4.2" />
      <Stroke d="M12.4 15.2h4.2" />
      <Stroke d="M12.4 18h2.6" />
      <Seed cx={10.3} cy={12.4} r={0.85} />
      <Seed cx={10.3} cy={15.2} r={0.85} />
      <Seed cx={10.3} cy={18} r={0.85} />
    </Icon>
  );
}

/**
 * Upload — a shoot rising out of the bed it was planted in.
 *
 * The bed now holds a document: a seed and a rule, the same bullet-and-line
 * pair the library page uses. It is what the arrow is carrying, and it is what
 * stops the tray reading as an empty bracket.
 */
export function IconUpload({ ...props }: IconProps) {
  return (
    <Icon glyph="upload" {...props}>
      <Stroke accent d="M12 14.6V4.6" />
      <Stroke accent d="M8.3 8.3 12 4.6l3.7 3.7" />
      <Stroke d="M4.6 13.6v4c0 1.35 1.15 2.5 2.5 2.5h9.8c1.35 0 2.5-1.15 2.5-2.5v-4" />
      <Stroke d="M9.6 17.2h6.8" />
      <Seed cx={7.4} cy={17.2} r={0.9} />
    </Icon>
  );
}

/**
 * Requirements — a handbook on the clip, with the first rule already met.
 *
 * The clip is the whole difference between a sheet and a set of criteria
 * somebody handed you. It straddles the board's top edge rather than sitting
 * above it, which is what makes it read as attached at 20px.
 */
export function IconRequirements({ ...props }: IconProps) {
  return (
    <Icon glyph="requirements" {...props}>
      <Stroke d="M5.6 7.9c0-1.3 1.05-2.35 2.35-2.35h8.1c1.3 0 2.35 1.05 2.35 2.35v10.1c0 1.3-1.05 2.35-2.35 2.35H7.95c-1.3 0-2.35-1.05-2.35-2.35Z" />
      <Stroke d="M8.9 7.3V5.7c0-.94.76-1.7 1.7-1.7h2.8c.94 0 1.7.76 1.7 1.7v1.6Z" />
      <Stroke accent d="m8.6 12.2 1.1 1.1 2.2-2.2" />
      <Stroke d="M15.6 15.9H8.4" />
      <Stroke d="M14 18.4H8.4" />
      <Seed cx={8.6} cy={12.2} r={0.9} />
    </Icon>
  );
}

/**
 * Settings — a bloom rather than a gear. Same affordance, our hand.
 *
 * Petals, an iris and a seeded centre. The concentric rings are what let
 * `bloom` mean something: the outline opens while the accent iris closes
 * against it, which reads as an aperture being adjusted rather than a shape
 * being scaled.
 */
export function IconSettings({ ...props }: IconProps) {
  return (
    <Icon glyph="settings" {...props}>
      <Stroke d="M12 4.2c1.5 0 2.2 1.6 3.5 2.1 1.3.5 2.9-.3 3.7 1 .8 1.3-.3 2.6-.3 4s1.1 2.7.3 4c-.8 1.3-2.4.5-3.7 1-1.3.5-2 2.1-3.5 2.1s-2.2-1.6-3.5-2.1c-1.3-.5-2.9.3-3.7-1-.8-1.3.3-2.6.3-4s-1.1-2.7-.3-4c.8-1.3 2.4-.5 3.7-1C9.8 5.8 10.5 4.2 12 4.2Z" />
      <Stroke d="M7.5 11.3a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0" />
      <Stroke accent d="M9.9 11.3a2.1 2.1 0 1 0 4.2 0 2.1 2.1 0 0 0-4.2 0" />
      <Seed cx={12} cy={11.3} r={0.8} />
    </Icon>
  );
}

/* ── Status + feedback ─────────────────────────────────────────────────── */

/** Score — an arc with the needle resting on it. */
export function IconScore({ ...props }: IconProps) {
  return (
    <Icon glyph="score" {...props}>
      <Stroke d="M3.8 16.6a8.6 8.6 0 1 1 16.4 0" />
      {/* The value swept so far, drawn inside the track. It is what makes this
          a gauge with a reading rather than an arc with a stick on it — and it
          is the same "arc plus fill" the real `ScoreArc` renders. */}
      <Stroke d="M7.4 16.6a4.6 4.6 0 0 1 7.9-3.2" />
      <Stroke accent d="M12 16.2 15.6 10" />
      <Seed cx={12} cy={16.6} r={1.4} />
    </Icon>
  );
}

/**
 * Findings — a list where one line is flagged.
 *
 * The flag is now a ringed alert rather than a bare bar and dot, which at 20px
 * was reading as a stray exclamation beside the text. Four rules instead of
 * three: three lines of falling length read as a paragraph tapering off, four
 * read as a list, and this is a list.
 */
export function IconFindings({ ...props }: IconProps) {
  return (
    <Icon glyph="findings" {...props}>
      <Stroke d="M4 7h8.6" />
      <Stroke d="M4 11h6.4" />
      <Stroke d="M4 15h4.2" />
      <Stroke d="M4 18.8h5.8" />
      <Stroke d="M13.8 13.6a3.9 3.9 0 1 0 7.8 0 3.9 3.9 0 0 0-7.8 0" />
      <Stroke accent d="M17.7 11.5v2.3" />
      <Seed cx={17.7} cy={16.2} r={0.85} />
    </Icon>
  );
}

/** Drafts — sheets stacked with a breath between them. */
export function IconDrafts({ ...props }: IconProps) {
  return (
    <Icon glyph="drafts" {...props}>
      <Stroke d="m12 3.6 8 4.1-8 4.1-8-4.1Z" />
      <Stroke d="m4 12.4 8 4.1 8-4.1" />
      <Stroke d="m4 16.8 8 4.1 8-4.1" />
      {/* The seed marks the sheet you are on. Three bare layers say "several
          versions"; the dot says which one is current, which is the question
          a draft stack is actually asked. */}
      <Seed cx={12} cy={7.7} r={0.9} />
    </Icon>
  );
}

/** Trend — a line that climbs and lands on a seed. */
export function IconTrend({ ...props }: IconProps) {
  return (
    <Icon glyph="trend" {...props}>
      <Stroke accent d="M4 16.4c2.6 0 3.6-3.4 6-3.4s3.2 2.2 5 2.2 3-2.6 5-6.2" />
      <Stroke d="M4 4.6v14.8h15.8" />
      <Seed cx={20} cy={9} />
    </Icon>
  );
}

/** Sprout — the empty/all-clear mark. Something ready to grow. */
export function IconSprout({ ...props }: IconProps) {
  return (
    <Icon glyph="sprout" {...props}>
      <Stroke accent d="M12 20.4v-6.6" />
      <Stroke d="M12 13.8C12 10.9 9.7 8.6 6.8 8.6H4.6v1.4c0 2.9 2.3 5.2 5.2 5.2H12" />
      <Stroke d="M12 13.2c0-2.6 2.1-4.6 4.6-4.6h2.8v1c0 2.6-2.1 4.6-4.6 4.6H12" />
      {/* Veins. Two strokes, and they are what stop the leaves reading as
          plain lozenges — the same articulation the brand leaf's midrib does,
          at a third the size. */}
      <Stroke d="M6.4 10.5c1.9.5 3.5 1.6 4.5 3.2" />
      <Stroke d="M17.7 10.4c-1.5.5-2.8 1.5-3.6 2.8" />
      <Seed cx={12} cy={20.4} r={0.9} />
    </Icon>
  );
}

/** Alert — a soft-shouldered triangle with the seed as its stop. */
export function IconAlert({ ...props }: IconProps) {
  return (
    <Icon glyph="alert" {...props}>
      <Stroke d="M10.3 4.6c.75-1.3 2.65-1.3 3.4 0l6.5 11.4c.75 1.3-.2 2.9-1.7 2.9H5.5c-1.5 0-2.45-1.6-1.7-2.9Z" />
      <Stroke accent d="M12 9.4v3.4" />
      <Seed cx={12} cy={16} />
    </Icon>
  );
}

/** Activity — a pulse, for the admin analyses feed. */
export function IconActivity({ ...props }: IconProps) {
  return (
    <Icon glyph="activity" {...props}>
      <Stroke d="M3.4 12h3.2l2.2-5.6 4 11.2 2.2-5.6h4.6" />
      <Seed cx={20.4} cy={12} r={0.9} />
    </Icon>
  );
}

/** Evals — a flask, drawn with the same soft shoulders as the alert. */
export function IconFlask({ ...props }: IconProps) {
  return (
    <Icon glyph="flask" {...props}>
      <Stroke d="M9.4 3.6v5.7L4.9 17c-.8 1.4.2 3.2 1.9 3.2h10.4c1.7 0 2.7-1.8 1.9-3.2l-4.5-7.7V3.6" />
      <Stroke d="M8.4 3.6h7.2" />
      <Stroke d="M7.2 14.6h9.6" />
      <Seed cx={10.4} cy={17.4} r={0.9} />
    </Icon>
  );
}

/** Users — two figures, the second half-hidden behind the first. */
export function IconUsers({ ...props }: IconProps) {
  return (
    <Icon glyph="users" {...props}>
      <Stroke d="M6.4 8.6a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 0 0-6.4 0" />
      <Stroke d="M3.4 19.6c0-3 2.8-5.2 6.2-5.2s6.2 2.2 6.2 5.2" />
      <Stroke d="M15.6 5.8a3.1 3.1 0 0 1 0 6" />
      <Stroke d="M17.2 14.9c2.1.6 3.6 2.4 3.6 4.7" />
    </Icon>
  );
}

/* ── Controls ──────────────────────────────────────────────────────────── */

export function IconCheck({ ...props }: IconProps) {
  return (
    <Icon glyph="check" {...props}>
      <Stroke d="m4.8 12.6 4.4 4.4L19.2 7" />
    </Icon>
  );
}

export function IconClose({ ...props }: IconProps) {
  return (
    <Icon glyph="close" {...props}>
      <Stroke d="M6 6l12 12" />
      <Stroke d="M18 6 6 18" />
    </Icon>
  );
}

export function IconArrowRight({ ...props }: IconProps) {
  return (
    <Icon glyph="arrow-right" {...props}>
      <Stroke d="M4.4 12h15" />
      <Stroke accent d="m13.4 6 6 6-6 6" />
    </Icon>
  );
}

export function IconChevronDown({ ...props }: IconProps) {
  return (
    <Icon glyph="chevron-down" {...props}>
      <Stroke d="m5.6 9 6.4 6.4L18.4 9" />
    </Icon>
  );
}

export function IconChevronUpDown({ ...props }: IconProps) {
  return (
    <Icon glyph="chevron-up-down" {...props}>
      <Stroke d="m8 10 4-4 4 4" />
      <Stroke d="m16 14-4 4-4-4" />
    </Icon>
  );
}

export function IconSearch({ ...props }: IconProps) {
  return (
    <Icon glyph="search" {...props}>
      <Stroke d="M4.6 10.9a6.3 6.3 0 1 0 12.6 0 6.3 6.3 0 0 0-12.6 0" />
      <Stroke d="m15.8 15.8 3.6 3.6" />
    </Icon>
  );
}

export function IconMenu({ ...props }: IconProps) {
  return (
    <Icon glyph="menu" {...props}>
      <Stroke d="M4 7h16" />
      <Stroke d="M4 12h16" />
      <Stroke d="M4 17h11" />
    </Icon>
  );
}

/** Rail toggle — a panel with its edge lifted. */
export function IconPanel({ ...props }: IconProps) {
  return (
    <Icon glyph="panel" {...props}>
      <Stroke d="M3.6 6.6c0-1.4 1.1-2.5 2.5-2.5h11.8c1.4 0 2.5 1.1 2.5 2.5v10.8c0 1.4-1.1 2.5-2.5 2.5H6.1c-1.4 0-2.5-1.1-2.5-2.5Z" />
      <Stroke d="M9.6 4.4v15.4" />
    </Icon>
  );
}

export function IconBell({ ...props }: IconProps) {
  return (
    <Icon glyph="bell" {...props}>
      <Stroke d="M6.2 10.4a5.8 5.8 0 0 1 11.6 0c0 3.4.8 5 1.6 5.9.4.5 0 1.3-.7 1.3H5.3c-.7 0-1.1-.8-.7-1.3.8-.9 1.6-2.5 1.6-5.9Z" />
      <Stroke accent d="M10.2 20.2a2.2 2.2 0 0 0 3.6 0" />
    </Icon>
  );
}

export function IconUser({ ...props }: IconProps) {
  return (
    <Icon glyph="user" {...props}>
      <Stroke d="M8.2 8.1a3.8 3.8 0 1 0 7.6 0 3.8 3.8 0 0 0-7.6 0" />
      <Stroke d="M4.6 20c0-3.5 3.3-6 7.4-6s7.4 2.5 7.4 6" />
    </Icon>
  );
}

export function IconSignOut({ ...props }: IconProps) {
  return (
    <Icon glyph="sign-out" {...props}>
      <Stroke d="M14.4 4.6H7.8A2.4 2.4 0 0 0 5.4 7v10a2.4 2.4 0 0 0 2.4 2.4h6.6" />
      <Stroke d="M11.6 12h8" />
      <Stroke accent d="m16.6 8.8 3.2 3.2-3.2 3.2" />
    </Icon>
  );
}

/** Working — a ring with one open quadrant, spun by the caller. */
export function IconSpinner({ ...props }: IconProps) {
  return (
    <Icon glyph="spinner" {...props}>
      <Stroke d="M12 4.2a7.8 7.8 0 1 1-7.8 7.8" />
    </Icon>
  );
}

/* ── Actions ───────────────────────────────────────────────────────────── */

export function IconPlus({ ...props }: IconProps) {
  return (
    <Icon glyph="plus" {...props}>
      <Stroke d="M12 4.8v14.4" />
      <Stroke d="M4.8 12h14.4" />
    </Icon>
  );
}

export function IconMinus({ ...props }: IconProps) {
  return (
    <Icon glyph="minus" {...props}>
      <Stroke d="M4.8 12h14.4" />
    </Icon>
  );
}

/** Refresh / re-run — an almost-closed loop with an arrowhead. */
export function IconRefresh({ ...props }: IconProps) {
  return (
    <Icon glyph="refresh" {...props}>
      <Stroke d="M19.6 12a7.6 7.6 0 1 1-2.4-5.6" />
      <Stroke accent d="M19.8 4.6v4.2h-4.2" />
    </Icon>
  );
}

export function IconPencil({ ...props }: IconProps) {
  return (
    <Icon glyph="pencil" {...props}>
      <Stroke d="M15.6 4.9a2.1 2.1 0 0 1 3 3L9.4 17.1l-4 1 1-4Z" />
      <Stroke accent d="m14.2 6.3 3 3" />
    </Icon>
  );
}

/**
 * Delete — a bin whose lid and handle are the accent, so `lift` opens it rather
 * than hopping the whole glyph. The seed sits inside the body: the thing being
 * thrown away is the live point of a delete.
 */
export function IconTrash({ ...props }: IconProps) {
  return (
    <Icon glyph="trash" {...props}>
      <Stroke accent d="M4.6 7.1c4.9-.7 9.9-.7 14.8 0" />
      <Stroke accent d="M9.7 6.4V5.5A1.5 1.5 0 0 1 11.2 4h1.6a1.5 1.5 0 0 1 1.5 1.5v.9" />
      <Stroke d="M6.4 9.6c3.7-.5 7.5-.5 11.2 0l-.8 8.4a2.1 2.1 0 0 1-2.1 1.9H9.3a2.1 2.1 0 0 1-2.1-1.9Z" />
      <Seed cx={12} cy={14.8} />
    </Icon>
  );
}

export function IconDownload({ ...props }: IconProps) {
  return (
    <Icon glyph="download" {...props}>
      <Stroke accent d="M12 4.4V15" />
      <Stroke accent d="m8.2 11.2 3.8 3.8 3.8-3.8" />
      <Stroke d="M4.5 15.4v2.3c0 1.3 1.1 2.4 2.4 2.4h10.2c1.3 0 2.4-1.1 2.4-2.4v-2.3" />
    </Icon>
  );
}

export function IconLink({ ...props }: IconProps) {
  return (
    <Icon glyph="link" {...props}>
      <Stroke d="M10.2 13.8a3.6 3.6 0 0 0 5.4.4l2.4-2.4a3.6 3.6 0 0 0-5.1-5.1l-1.4 1.4" />
      <Stroke d="M13.8 10.2a3.6 3.6 0 0 0-5.4-.4L6 12.2a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4" />
    </Icon>
  );
}

export function IconSend({ ...props }: IconProps) {
  return (
    <Icon glyph="send" {...props}>
      <Stroke d="M20.4 3.6 10.6 13.4" />
      <Stroke d="M20.4 3.6 14.2 20.4l-3.6-7-7-3.6Z" />
    </Icon>
  );
}

export function IconPlay({ ...props }: IconProps) {
  return (
    <Icon glyph="play" {...props}>
      <Stroke d="M8.2 5.6c0-.9 1-1.5 1.8-1L18.6 11c.7.5.7 1.5 0 2l-8.6 6.4c-.8.5-1.8-.1-1.8-1Z" />
    </Icon>
  );
}

export function IconSkip({ ...props }: IconProps) {
  return (
    <Icon glyph="skip" {...props}>
      <Stroke d="M5.4 6.4c0-.8.9-1.3 1.6-.9l7.6 5.6c.6.4.6 1.4 0 1.8L7 18.5c-.7.4-1.6-.1-1.6-.9Z" />
      <Stroke d="M18.2 5.6v12.8" />
    </Icon>
  );
}

export function IconMore({ ...props }: IconProps) {
  return (
    <Icon glyph="more" {...props}>
      <Seed cx={5.6} cy={12} r={1.4} />
      <Seed cx={12} cy={12} r={1.4} />
      <Seed cx={18.4} cy={12} r={1.4} />
    </Icon>
  );
}

/* ── Signals ───────────────────────────────────────────────────────────── */

/** AI — a four-point spark. The ONLY glyph allowed to carry the AI colour. */
export function IconAi({ ...props }: IconProps) {
  return (
    <Icon glyph="ai" {...props}>
      <Stroke d="M12 3.4c0 3.9 1.9 5.8 5.8 5.8-3.9 0-5.8 1.9-5.8 5.8 0-3.9-1.9-5.8-5.8-5.8 3.9 0 5.8-1.9 5.8-5.8Z" />
      <Stroke accent d="M17.8 15c0 2 1 3 3 3-2 0-3 1-3 3 0-2-1-3-3-3 2 0 3-1 3-3Z" />
    </Icon>
  );
}

export function IconInfo({ ...props }: IconProps) {
  return (
    <Icon glyph="info" {...props}>
      <Stroke d="M4.2 12a7.8 7.8 0 1 0 15.6 0 7.8 7.8 0 0 0-15.6 0" />
      <Stroke d="M12 11.2v5" />
      <Seed cx={12} cy={8.2} r={1} />
    </Icon>
  );
}

/** Resolved — the tick inside its own ring. */
export function IconCheckCircle({ ...props }: IconProps) {
  return (
    <Icon glyph="check-circle" {...props}>
      <Stroke d="M4.2 12a7.8 7.8 0 1 0 15.6 0 7.8 7.8 0 0 0-15.6 0" />
      <Stroke accent d="m8.4 12.2 2.5 2.5 4.8-5.1" />
    </Icon>
  );
}

/** Unknown / unmatched — a page with a question in it. */
export function IconFileQuestion({ ...props }: IconProps) {
  return (
    <Icon glyph="file-question" {...props}>
      <Stroke d="M6 6.2c0-1.2 1-2.2 2.2-2.2h4.6L18 9.2v8.6c0 1.2-1 2.2-2.2 2.2H8.2c-1.2 0-2.2-1-2.2-2.2Z" />
      <Stroke d="M12.7 4v3.1c0 .8.6 1.4 1.4 1.4H18" />
      <Stroke d="M10.3 12.4a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.7-.8 1.2v.3" />
      <Seed cx={12} cy={17.8} r={0.9} />
    </Icon>
  );
}

export function IconIdea({ ...props }: IconProps) {
  return (
    <Icon glyph="idea" {...props}>
      <Stroke d="M9 16.4a6 6 0 1 1 6 0v1.4a1.6 1.6 0 0 1-1.6 1.6h-2.8A1.6 1.6 0 0 1 9 17.8Z" />
      <Stroke d="M10.2 21.4h3.6" />
    </Icon>
  );
}

export function IconInbox({ ...props }: IconProps) {
  return (
    <Icon glyph="inbox" {...props}>
      <Stroke d="M3.8 13.4 6.4 5.6c.3-.9 1.1-1.5 2.1-1.5h7c1 0 1.8.6 2.1 1.5l2.6 7.8" />
      <Stroke d="M3.8 13.4h4.4l1.2 2.4h5.2l1.2-2.4h4.4v4.6c0 1.3-1 2.3-2.3 2.3H6.1a2.3 2.3 0 0 1-2.3-2.3Z" />
    </Icon>
  );
}

export function IconMailCheck({ ...props }: IconProps) {
  return (
    <Icon glyph="mail-check" {...props}>
      <Stroke d="M3.8 7.4c0-1.3 1-2.3 2.3-2.3h11.8c1.3 0 2.3 1 2.3 2.3v5" />
      <Stroke d="m3.9 7 7.1 4.9c.6.4 1.4.4 2 0L20.1 7" />
      <Stroke d="M3.8 7.4v9.2c0 1.3 1 2.3 2.3 2.3h6.4" />
      <Stroke accent d="m15.4 17.6 1.8 1.8 3.4-3.6" />
    </Icon>
  );
}

export function IconMic({ ...props }: IconProps) {
  return (
    <Icon glyph="mic" {...props}>
      <Stroke d="M12 3.6a2.8 2.8 0 0 1 2.8 2.8v5.2a2.8 2.8 0 1 1-5.6 0V6.4A2.8 2.8 0 0 1 12 3.6Z" />
      <Stroke d="M6.4 11.4a5.6 5.6 0 0 0 11.2 0" />
      <Stroke d="M12 17v3.4" />
    </Icon>
  );
}

export function IconThumbUp({ ...props }: IconProps) {
  return (
    <Icon glyph="thumb-up" {...props}>
      <Stroke d="M7.4 20.2V10.6l3.8-6.4c1.3 0 2.3 1 2.3 2.3v3.5h4.6a2 2 0 0 1 2 2.4l-1.3 5.8a2 2 0 0 1-2 1.6Z" />
      <Stroke d="M7.4 10.6H4.6v9.6h2.8" />
    </Icon>
  );
}

export function IconThumbDown({ ...props }: IconProps) {
  return (
    <Icon glyph="thumb-down" {...props}>
      <Stroke d="M7.4 3.8v9.6l3.8 6.4c1.3 0 2.3-1 2.3-2.3v-3.5h4.6a2 2 0 0 0 2-2.4l-1.3-5.8a2 2 0 0 0-2-1.6Z" />
      <Stroke d="M7.4 13.4H4.6V3.8h2.8" />
    </Icon>
  );
}

/** Defense / viva — a mortarboard, softened at the corners like the rest. */
export function IconGraduation({ ...props }: IconProps) {
  return (
    <Icon glyph="graduation" {...props}>
      <Stroke d="M2.8 8.6 12 4.4l9.2 4.2L12 12.8Z" />
      <Stroke d="M6.6 10.6v4.9c0 .7.4 1.3 1 1.6 1.3.7 2.9 1.1 4.4 1.1s3.1-.4 4.4-1.1c.6-.3 1-.9 1-1.6v-4.9" />
      <Stroke accent d="M21.2 8.8v5.4" />
    </Icon>
  );
}

/** History — a clock with the hand wound backwards. */
export function IconHistory({ ...props }: IconProps) {
  return (
    <Icon glyph="history" {...props}>
      <Stroke d="M4.4 12a7.6 7.6 0 1 0 2.4-5.6" />
      <Stroke d="M4.2 4.6v4.2h4.2" />
      <Stroke accent d="M12 8.2V12l2.8 1.7" />
    </Icon>
  );
}

export function IconChevronLeft({ ...props }: IconProps) {
  return (
    <Icon glyph="chevron-left" {...props}>
      <Stroke d="M15 5.6 8.6 12 15 18.4" />
    </Icon>
  );
}

export function IconChevronUp({ ...props }: IconProps) {
  return (
    <Icon glyph="chevron-up" {...props}>
      <Stroke d="m5.6 15 6.4-6.4L18.4 15" />
    </Icon>
  );
}

export function IconClock({ ...props }: IconProps) {
  return (
    <Icon glyph="clock" {...props}>
      <Stroke d="M4.2 12a7.8 7.8 0 1 0 15.6 0 7.8 7.8 0 0 0-15.6 0" />
      <Stroke accent d="M12 7.6V12l3 1.8" />
    </Icon>
  );
}
