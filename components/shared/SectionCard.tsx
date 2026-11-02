import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The default container for everything in the app.
 *
 * `padded={false}` is for content that must reach the card edge — tables,
 * lists with their own row padding, the PDF viewer.
 */
export interface SectionCardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  /** Right-aligned slot in the card header. */
  headerAction?: React.ReactNode;
  padded?: boolean;
  /**
   * The pine hairline down the left edge, lifted from the landing page's
   * bento tiles.
   *
   * Opt-in rather than the default. It is what gives a tile its weight there,
   * and putting it on every card in the app at once would turn a signature
   * into wallpaper — the app has screens that are nothing but stacked cards.
   *
   * CURRENTLY UNUSED, and that is worth knowing before reaching for it. The
   * dashboard was its one caller and dropped it: pine on `bg-green-050` reads
   * as an accent, but the same 2px on cream reads as a near-black rule, and a
   * column of cards each carrying one reads as a ledger. It survives because
   * the device is right on a card that stands alone or against a coloured
   * ground — `PaperCard` draws its own for exactly that reason. Check it on
   * the ground you are putting it on, not on the landing page.
   */
  edge?: boolean;
  className?: string;
  contentClassName?: string;
  /**
   * Escape hatch for inline custom properties — `--i` for a `.rise-stagger`
   * position, chiefly. Deliberately not a general style prop in spirit: colour
   * and spacing belong in classes, and `globals.css` owns the values.
   */
  style?: React.CSSProperties;
}

export function SectionCard({
  children,
  title,
  description,
  headerAction,
  padded = true,
  edge = false,
  className,
  contentClassName,
  style,
}: SectionCardProps) {
  const hasHeader = Boolean(title ?? description ?? headerAction);

  return (
    <Card
      className={cn(edge && "relative overflow-hidden", className)}
      style={style}
    >
      {edge ? (
        /* Pine, and chrome rather than a status — the same rule the landing
           tiles carry, at the same 2px. `inset-y-0` so it runs the card's full
           height however the content grows. */
        <span
          aria-hidden="true"
          className="bg-primary absolute inset-y-0 left-0 w-0.5"
        />
      ) : null}

      {hasHeader ? (
        <CardHeader>
          <div className="min-w-0">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          {headerAction ? (
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
            </div>
          ) : null}
        </CardHeader>
      ) : null}

      <CardContent
        className={cn(
          padded ? (hasHeader ? "px-5 pb-5" : "p-5") : "px-0 pb-0",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
