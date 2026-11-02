import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, taught the design system's own font sizes.
 *
 * `globals.css` defines five type steps — `--text-page-title`,
 * `--text-section-title`, `--text-body`, `--text-meta`, `--text-micro`.
 * tailwind-merge ships knowing only Tailwind's stock scale, and its fallback
 * for an unrecognised `text-*` is to treat it as a COLOUR. So `text-micro` and
 * `text-meta` were being filed in the same conflict group as `text-ink`, and
 * whichever came second silently deleted the other:
 *
 *     twMerge("bg-ink text-bg z-50 text-micro")  →  "bg-ink z-50 text-micro"
 *     twMerge("text-muted text-meta")            →  "text-meta"
 *     twMerge("text-meta text-muted")            →  "text-muted"
 *
 * The first line is why every tooltip in the app rendered as a solid dark
 * block: `TooltipContent` asks for `text-bg` on `bg-ink`, the colour was
 * dropped, the text inherited `--color-ink`, and ink on ink is 1:1.
 *
 * Registering the five as a `font-size` group fixes it everywhere at once and
 * keeps real conflicts collapsing — two sizes still resolve to the last, as do
 * two colours.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["page-title", "section-title", "body", "meta", "micro"] },
      ],
    },
  },
});

/** Merges conditional class names, resolving conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * First character of an email address, upper-cased — the avatar fallback used
 * by the sidebar user block. Returns "?" for an empty or malformed address so
 * the avatar never renders blank.
 */
export function initialFromEmail(email: string | null | undefined): string {
  if (!email) return "?";
  const first = email.trim().charAt(0);
  return first === "" ? "?" : first.toUpperCase();
}

/** Truncates in the middle, keeping the tail — good for emails and filenames. */
export function truncateMiddle(value: string, max = 28): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}
