/**
 * Title and author agreement — the check that separates VERIFIED from
 * NEEDS_CORRECTION.
 *
 * PURE. No I/O, no network, no clock. When a DOI resolves, we still have to ask:
 * does it point at the paper the student *cited*, or a different one? A DOI that
 * resolves to the wrong title is the most dangerous case in the whole feature —
 * it looks verified but isn't — so this similarity decides it, and it is unit
 * tested in `__tests__/matchTitle.test.ts`.
 *
 * The metric is deliberately forgiving of the ways two records of the SAME work
 * disagree (subtitle present or absent, punctuation, diacritics, "and" vs "&")
 * and strict about a genuinely DIFFERENT work.
 */

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normaliseForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  const set = new Set<string>();
  for (const token of normaliseForMatch(value).split(" ")) {
    // Drop one-character noise, keep everything else (numbers matter in titles).
    if (token.length >= 2) set.add(token);
  }
  return set;
}

/**
 * Token-set overlap, biased toward the CITED title. We measure how much of the
 * cited title is present in the candidate, not symmetric Jaccard — a candidate
 * whose title is "cited title + long subtitle" should still count as a strong
 * match, and containment captures that where Jaccard would penalise it.
 */
export function titleSimilarity(
  citedTitle: string,
  candidateTitle: string,
): number {
  const cited = tokenSet(citedTitle);
  const candidate = tokenSet(candidateTitle);
  if (cited.size === 0 || candidate.size === 0) return 0;

  let shared = 0;
  for (const token of cited) {
    if (candidate.has(token)) shared += 1;
  }

  const containment = shared / cited.size;
  const jaccard = shared / (cited.size + candidate.size - shared);
  // Blend: containment carries the case above, Jaccard guards against a short
  // cited title matching a totally different long one by coincidence.
  return Number((0.65 * containment + 0.35 * jaccard).toFixed(3));
}

/** Particles that are never a surname: "et al.", conjunctions, initials-noise. */
const NON_SURNAME = new Set([
  "et",
  "al",
  "and",
  "und",
  "the",
  "van",
  "von",
  "de",
  "der",
]);

/** The surname is the most stable part of an author string across styles. */
export function surnameOf(author: string): string {
  // "Vaswani, Ashish" → the family name is before the comma.
  if (author.includes(","))
    return normaliseForMatch(author.split(",")[0] ?? "");

  // "Ashish Vaswani" / "Vaswani et al." → last meaningful token, dropping "et
  // al." and name particles so the surname survives an abbreviated author list.
  const parts = normaliseForMatch(author)
    .split(" ")
    .filter((token) => token.length > 1 && !NON_SURNAME.has(token));
  return parts[parts.length - 1] ?? "";
}

/**
 * True when the cited authors and the candidate's authors plausibly overlap.
 * A single shared surname is enough — reference lists abbreviate author lists
 * constantly ("et al."), so requiring full agreement would reject real matches.
 */
export function authorsAgree(
  citedAuthors: readonly string[],
  candidateAuthors: readonly string[],
): boolean {
  if (citedAuthors.length === 0 || candidateAuthors.length === 0) return false;
  const candidateSurnames = new Set(
    candidateAuthors.map(surnameOf).filter((s) => s.length > 1),
  );
  return citedAuthors
    .map(surnameOf)
    .filter((s) => s.length > 1)
    .some((surname) => candidateSurnames.has(surname));
}

export interface MatchAssessment {
  similarity: number;
  authorsAgree: boolean;
  /** True when this candidate is confidently the SAME work as the citation. */
  isSameWork: boolean;
}

/**
 * Assesses whether a provider record is the same work as the cited reference.
 *
 * Same work when the title similarity clears the threshold. Author agreement
 * RESCUES a slightly-below-threshold title (same authors + close title = same
 * work) but is never required on its own — two different papers by the same
 * author must not be conflated.
 */
export function assessMatch(
  cited: { title: string | null; authors: readonly string[] },
  candidate: { title: string | null; authors: readonly string[] },
  threshold: number,
): MatchAssessment {
  const similarity =
    cited.title && candidate.title
      ? titleSimilarity(cited.title, candidate.title)
      : 0;
  const agree = authorsAgree(cited.authors, candidate.authors);

  const isSameWork =
    similarity >= threshold || (agree && similarity >= threshold - 0.15);

  return { similarity, authorsAgree: agree, isSameWork };
}
