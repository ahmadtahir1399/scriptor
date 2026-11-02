/**
 * Resolving a verbatim quote to a word-index range.
 *
 * This is the bridge to P7's highlights: a finding carries a `quote` copied
 * from the document, and P7 needs the `word_index` span that quote occupies so
 * it can draw a box over exactly those words.
 *
 * PURE — no I/O. Fully unit-tested in `__tests__/resolveFindings.test.ts`.
 *
 * The rule that governs everything here: a quote that cannot be located is
 * DROPPED, never guessed. An unlocatable finding is worse than no finding,
 * because a highlight on the wrong sentence makes the whole product look
 * broken. We would rather show eleven findings we can place than twelve where
 * one floats.
 */

export interface WordRef {
  text: string;
  wordIndex: number;
}

export interface WordRange {
  wordIndexStart: number;
  wordIndexEnd: number;
}

/**
 * Normalises text for comparison.
 *
 * PDF extraction and model output disagree constantly on whitespace, smart
 * quotes, ligatures and hyphenation. Comparing raw strings would drop most
 * genuinely-correct findings. We lower-case, fold common typographic variants
 * to ASCII, strip everything that is not a letter or digit, and collapse
 * spacing — so "„Müller (2019)"" and "Muller (2019)" compare equal.
 */
export function normaliseForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/­/g, "") // soft hyphen
    .replace(/\s+/g, " ")
    .trim();
}

/** Same as above but also removes punctuation, for a looser second pass. */
function normaliseAlnum(text: string): string {
  return normaliseForMatch(text)
    .replace(/[^a-z0-9äöüß ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Finds the word-index range whose words spell out `quote`.
 *
 * Two passes. The first matches on normalised text including punctuation; if
 * that fails, the second retries ignoring punctuation, which recovers findings
 * where the model dropped a comma or the parser split a bracket oddly. Both
 * slide a window over the words and compare the joined text, so the match is
 * contiguous by construction — P7 gets one unbroken span, never a scatter.
 */
export function resolveQuoteToWordRange(
  quote: string,
  words: readonly WordRef[],
): WordRange | null {
  const target = normaliseForMatch(quote);
  if (target.length === 0 || words.length === 0) return null;

  const strict = slideMatch(quote, words, normaliseForMatch);
  if (strict) return strict;

  // Looser retry only when the strict pass found nothing.
  return slideMatch(quote, words, normaliseAlnum);
}

/** True when the leftover after a prefix match is only punctuation/whitespace. */
function isPunctuationOnly(text: string): boolean {
  return /^[^a-z0-9äöüß]*$/.test(text);
}

/**
 * Slides a window across the words, growing it from each start position for as
 * long as the accumulated text remains a viable prefix of the target.
 *
 * Verbatim quotes align to WORD BOUNDARIES, so the match model is prefix-based,
 * not substring-based: a window matches when its joined text equals the target,
 * or equals the target followed only by trailing punctuation (a word like
 * "2019)." completing the quote "…2019)"). A plain `includes` check would wrongly
 * accept "the study" as a match for "study" — the window contains the target but
 * starts two words too early.
 *
 * Growth stops as soon as the window is no longer a prefix of the target, which
 * keeps this close to linear in practice; it runs against a single page's
 * words, a few hundred at most.
 */
function slideMatch(
  quote: string,
  words: readonly WordRef[],
  normalise: (text: string) => string,
): WordRange | null {
  const target = normalise(quote);
  if (target.length === 0) return null;

  for (let start = 0; start < words.length; start += 1) {
    let joined = "";

    for (let length = 1; start + length <= words.length; length += 1) {
      const word = words[start + length - 1];
      if (!word) break;

      const normalisedWord = normalise(word.text);
      joined =
        joined.length === 0 ? normalisedWord : `${joined} ${normalisedWord}`;

      const startWord = words[start];
      if (!startWord) break; // start is in range, but satisfies noUncheckedIndexedAccess
      const endWord = word;

      // Exact whole-window match.
      if (joined === target) {
        return {
          wordIndexStart: startWord.wordIndex,
          wordIndexEnd: endWord.wordIndex,
        };
      }

      // Window overshoots the target — accept only if the overshoot is pure
      // trailing punctuation (e.g. a closing bracket the parser kept on the
      // last word). Otherwise this start has grown past a real word boundary
      // and cannot produce a boundary-aligned match.
      if (joined.startsWith(target)) {
        if (isPunctuationOnly(joined.slice(target.length))) {
          return {
            wordIndexStart: startWord.wordIndex,
            wordIndexEnd: endWord.wordIndex,
          };
        }
        break;
      }

      // Still building: keep going only while the window remains a prefix of the
      // target. Once it diverges, no longer window from this start can match.
      if (!target.startsWith(joined)) {
        break;
      }
    }
  }

  return null;
}

export interface OverlapItem extends WordRange {
  /** Higher wins when two findings overlap the same words. */
  severityRank: number;
}

/**
 * Removes findings that overlap the same word range, keeping the highest
 * severity. Two checks flagging the same sentence should show the student one
 * mark, not a stack of three.
 *
 * Returns the indices to KEEP, so the caller can map back to its own richer
 * finding objects without this function needing to know their shape.
 */
export function dedupeOverlapping<T extends OverlapItem>(
  items: readonly T[],
): T[] {
  // Widest first, then most severe, so a broad high-severity finding wins over
  // a narrow low-severity one it contains.
  const ordered = [...items].sort((a, b) => {
    const spanA = a.wordIndexEnd - a.wordIndexStart;
    const spanB = b.wordIndexEnd - b.wordIndexStart;
    if (spanB !== spanA) return spanB - spanA;
    return b.severityRank - a.severityRank;
  });

  const kept: T[] = [];

  for (const item of ordered) {
    const overlapsKept = kept.some((existing) => rangesOverlap(existing, item));
    if (!overlapsKept) kept.push(item);
  }

  // Restore document order for a stable, readable result.
  return kept.sort((a, b) => a.wordIndexStart - b.wordIndexStart);
}

function rangesOverlap(a: WordRange, b: WordRange): boolean {
  return (
    a.wordIndexStart <= b.wordIndexEnd && b.wordIndexStart <= a.wordIndexEnd
  );
}
