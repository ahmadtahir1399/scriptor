import * as React from "react";

import { cn } from "@/lib/utils";

interface WordRevealProps {
  /** The full sentence. Split here, on the server. */
  text: string;
  as?: "h1" | "h2" | "p";
  className?: string;
  /** Offset the whole reveal, to sequence it after an eyebrow or rule. */
  delayMs?: number;
}

/**
 * A headline whose words rise into place one after another.
 *
 * A Server Component, which is the entire point. The words are split into
 * spans during the server render and animated by the `.word-rise` keyframe in
 * `globals.css`, so this ships no JavaScript and the finished sentence exists
 * as real text in the markup — selectable, translatable, and read normally by
 * a screen reader.
 *
 * The alternative, GSAP's SplitText, would rewrite the DOM after hydration:
 * a client bundle, a frame of unsplit text, and a headline that assistive tech
 * meets mid-surgery. The motion is identical. This costs nothing.
 */
export function WordReveal({
  text,
  as: Tag = "h1",
  className,
  delayMs = 0,
}: WordRevealProps) {
  const words = text.split(" ");

  return (
    <Tag
      className={cn("word-rise", className)}
      style={{ "--word-delay": `${delayMs}ms` } as React.CSSProperties}
    >
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          {/* Outer span is the clipping mask, inner is what travels. */}
          <span style={{ "--i": index } as React.CSSProperties}>
            <span>{word}</span>
          </span>
          {index < words.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </Tag>
  );
}
