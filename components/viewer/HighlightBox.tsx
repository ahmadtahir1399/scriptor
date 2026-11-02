"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { FindingType } from "@/lib/db/enums";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import type { Rect } from "@/lib/viewer/geometry";

/**
 * One highlight rectangle — a single merged line of a finding.
 *
 * Absolutely positioned over the canvas, never drawn onto it, so it stays
 * interactive and independently restyleable. Colour is semantic (P0's rule):
 *   grammar / spelling / punctuation → soft warning underline
 *   style (content) → highlight block fill
 *   resolved → muted grey
 * `--color-ai` is reserved for AI spans and is applied only when `isAi`.
 *
 * A focused finding breathes once (scale/opacity); with reduced motion it shows
 * a static ring instead — never nothing, so the deep-link target is always
 * visibly indicated.
 */
export interface HighlightBoxProps {
  rect: Rect;
  type: FindingType;
  resolved: boolean;
  focused: boolean;
  hovered: boolean;
  isAi?: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
  label: string;
}

const UNDERLINE_TYPES: readonly FindingType[] = [
  "GRAMMAR",
  "SPELLING",
  "PUNCTUATION",
];

export function HighlightBox({
  rect,
  type,
  resolved,
  focused,
  hovered,
  isAi = false,
  onHoverStart,
  onHoverEnd,
  onClick,
  label,
}: HighlightBoxProps) {
  const reduced = useReducedMotion();
  const underline = UNDERLINE_TYPES.includes(type);

  const base =
    "pointer-events-auto absolute cursor-pointer rounded-[2px] transition-colors";

  const tone = resolved
    ? "bg-muted/15 border-b-2 border-muted/40"
    : isAi
      ? "bg-ai/15 border-b-2 border-ai"
      : underline
        ? cn(
            "border-b-2 border-warning",
            hovered ? "bg-warning/20" : "bg-warning/10",
          )
        : cn(hovered ? "bg-highlight/80" : "bg-highlight/50");

  return (
    <motion.button
      type="button"
      aria-label={label}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      onClick={onClick}
      className={cn(base, tone, focused && "ring-primary ring-2 ring-offset-1")}
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
      initial={false}
      animate={
        focused && !reduced
          ? { scale: [1, 1.06, 1], opacity: [1, 0.7, 1] }
          : { scale: 1, opacity: 1 }
      }
      transition={{ duration: 0.7, ease: "easeOut" }}
    />
  );
}
