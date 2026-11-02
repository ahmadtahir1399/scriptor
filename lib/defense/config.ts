/**
 * Defense-prep configuration.
 *
 * Question count and difficulty mix are config, not magic numbers — the seat for
 * a future "quick vs thorough" toggle, and the one place the useful 15–25 range
 * is stated.
 */

/** The useful number of questions to generate. Fewer feels thin; more, exhausting. */
export const DEFENSE_QUESTION_RANGE = { min: 15, max: 25 } as const;

/** Canonical themes the model clusters into; order is examiner-likelihood. */
export const DEFENSE_THEMES = [
  "Methodology & Rigour",
  "Contribution & Originality",
  "Results & Interpretation",
  "Limitations",
  "Literature & Positioning",
] as const;
export type DefenseTheme = (typeof DEFENSE_THEMES)[number];

/** The three difficulty tiers, stored onto the finding_severity enum. */
export const DIFFICULTIES = ["foundational", "probing", "challenging"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DEFENSE_LIMITS = {
  maxGroups: 6,
  maxQuestionsPerGroup: 8,
  /** How many BODY pages of the thesis to feed generation (abstract-heavy). */
  maxBodyPages: 30,
  /*
   * The largest output the app asks any model for, and sized from measurement
   * rather than by analogy to the other call sites.
   *
   * This was 4096, which silently broke the whole feature. The prompt asks for
   * 15–25 questions, each carrying an explanation, a full model answer, 2–4 key
   * points and a source quote, across up to `maxGroups` groups. Measured
   * against gpt-5.4 on a short thesis that lands at ~6,000 completion tokens —
   * so 4096 truncated every response mid-JSON, `completeStructured` failed to
   * parse it, and the handler wrote defense_status = ERROR every time.
   *
   * 16k is ~2.7x the measured need, which is the headroom a longer thesis or a
   * denser weakness list requires. It costs nothing to raise: this is a ceiling,
   * not a reservation, and billing is on tokens actually produced.
   */
  maxGenerationTokens: 16384,
  /* Feedback on ONE practice answer — small by nature, unlike the above. */
  maxFeedbackTokens: 800,
} as const;

/** Verdict → a 0–100 score, so a practice session can show an average. */
export const VERDICT_SCORE = {
  strong: 85,
  adequate: 65,
  needs_work: 40,
} as const;
