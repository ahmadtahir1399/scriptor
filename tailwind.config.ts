import type { Config } from "tailwindcss";

/**
 * Tailwind v4 is CSS-first: the design tokens themselves live in the `@theme`
 * block of `app/globals.css`, which IS the Tailwind theme. This file is loaded
 * from there via `@config` and carries the things that still belong in JS —
 * source globs, the dark-mode strategy, and container defaults.
 *
 * Do not add colours here. A colour added here would be invisible to the
 * `@theme` block and would break the "one source of truth" rule that every
 * later prompt depends on.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./providers/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
