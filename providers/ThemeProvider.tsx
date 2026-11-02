"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { STORAGE_KEYS } from "@/lib/constants";

/**
 * Outermost provider. Applies the `.dark` class to <html> before paint so
 * there is no flash of the wrong theme.
 *
 * Light is the primary experience; `defaultTheme` is deliberately "light"
 * rather than "system" so a student on a dark-themed OS still gets the
 * document-first look unless they opt out.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey={STORAGE_KEYS.theme}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
