/**
 * Whether a requirement can be verified from extracted text — the honesty
 * feature made mechanical.
 *
 * PURE. No I/O, no model. Scriptor reads a thesis as TEXT, so anything that
 * lives in the physical layout — margins, font size or family, line spacing,
 * page dimensions, binding, print colour — cannot be verified and must be
 * marked "manual only" rather than guessed. Marking these honestly is what lets
 * a student trust the ones Scriptor DOES check; a confident wrong answer here
 * would poison the whole feature.
 *
 * Checkability is DERIVED, not stored: `requirements` has no `is_unsupported`
 * column, so this classifier is the single source of that truth, run wherever
 * the flag is needed (UI markers, and the enqueue filter that never runs an
 * unsupported rule). Unit tested in `__tests__/classifyCheckable.test.ts`.
 */

export interface CheckableVerdict {
  checkable: boolean;
  /** i18n key for the plain "why not" reason, when not checkable. */
  reasonKey?: "margins" | "font" | "spacing" | "physical" | "color";
}

/** Ordered so the most specific/decisive signal wins the reason label. */
const UNSUPPORTED_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  reasonKey: CheckableVerdict["reasonKey"];
}> = [
  { pattern: /\bmargins?\b/i, reasonKey: "margins" },
  {
    pattern:
      /\bfont(\s?(size|family|type|face))?\b|\btypeface\b|\b\d{1,2}\s?(pt|point|points)\b|\b(times new roman|arial|calibri|helvetica|garamond|serif|sans[- ]?serif)\b/i,
    reasonKey: "font",
  },
  {
    pattern:
      /\b(line[- ]?spacing|double[- ]?spac\w*|single[- ]?spac\w*|1\.5[- ]?spac\w*|spacing)\b/i,
    reasonKey: "spacing",
  },
  {
    pattern:
      /\b(page (size|dimension)|paper size|a4|a5|letter[- ]?size|binding|bound|printed?|hard\s?copy|physical|portrait|landscape orientation)\b/i,
    reasonKey: "physical",
  },
  {
    pattern:
      /\b(colou?r printing|print(ed)? in colou?r|black[- ]?and[- ]?white)\b/i,
    reasonKey: "color",
  },
];

/**
 * @param text  The requirement's title and description, concatenated.
 * @param _category  ACCEPTED AND IGNORED. Every one of the five call sites
 *   passes `requirement.category`, which reads as though the category
 *   participates in the verdict. It does not, and that is deliberate rather
 *   than unfinished: the vocabulary in `config.ts` does not separate cleanly
 *   into checkable and physical. "Formatting" covers both "every figure must
 *   have a caption in the format 'Figure N: …'" (checkable, and covered by a
 *   test) and "all margins must be 2.5 cm" (not). Rejecting on category would
 *   therefore drop real, checkable rules from `enqueue.ts` — a silent
 *   false-negative in the analysis pipeline, which is worse than the
 *   false-positive it would fix. The parameter stays so the call sites keep
 *   compiling if a better signal arrives.
 */
export function classifyCheckable(
  text: string,
  _category?: string | null,
): CheckableVerdict {
  const haystack = text.trim();
  if (haystack.length === 0) return { checkable: false, reasonKey: "physical" };

  for (const { pattern, reasonKey } of UNSUPPORTED_PATTERNS) {
    if (pattern.test(haystack)) return { checkable: false, reasonKey };
  }

  return { checkable: true };
}
