import "server-only";

/**
 * Prompt caching layout.
 *
 * This is the single most important cost mechanism in the build. The document
 * body is large and byte-identical across all nine ALL_PAGES checks on an
 * upload; caching means the first check pays full input price and the other
 * eight read the body from cache at a fraction of the cost. Get it wrong and a
 * $0.40 analysis becomes $4.
 *
 * ---------------------------------------------------------------------------
 * HOW OPENAI CACHING WORKS — and why there is no cache_control marker here.
 * ---------------------------------------------------------------------------
 * OpenAI prompt caching is AUTOMATIC and PREFIX-BASED. There is no per-message
 * marker (that is Anthropic's model). OpenAI hashes the longest common prefix
 * of the messages array — from the very first token — and serves a cache hit
 * for any request sharing a ≥1024-token prefix seen in the last few minutes.
 *
 * The entire mechanism is therefore ORDERING. The cacheable content must:
 *   1. come FIRST, so it is part of the prefix, and
 *   2. be BYTE-IDENTICAL across the checks that should share the cache.
 *
 * Anything variable placed before the body gives each check a different prefix
 * and busts the cache for everything after it. So the layout is fixed:
 *
 *   [ system:  GENERIC reviewer instructions ]  ← identical across ALL checks
 *   [ user:    the document body for this scope ] ← identical across ALL checks
 *   [ user:    this check's analysis prompt ]     ← VARIES, always last
 *
 * The generic system message is shared by every check; the check-specific
 * prompt from `check_versions.analysis_prompt` is the trailing variable part.
 * That keeps `[system][body]` stable so the body is one cache entry reused nine
 * times.
 *
 * If the provider is ever swapped for Anthropic, this is the one file that
 * changes: add `cache_control: { type: "ephemeral" }` to the body block. The
 * call sites, which only ever hand us (system, body, instruction), do not.
 * ---------------------------------------------------------------------------
 */

/** The generic reviewer system prompt, shared across every rated check. */
export const SHARED_REVIEWER_SYSTEM = `You are a meticulous academic reviewer assisting a thesis supervisor.

You will be given the text of a student's thesis (or the relevant pages of it), followed by a specific reviewing task. Read the document carefully, then carry out ONLY the task described at the end.

Non-negotiable rules that apply to every task:
- Every issue you report MUST include a "quote" field copied VERBATIM from the document — character for character, no paraphrase, no normalisation, no correction of the student's spelling. If you cannot reproduce the exact text, omit the issue entirely. An issue that cannot be quoted cannot be located in the document and is useless.
- Quote the smallest span that unambiguously identifies the issue, and enough of it that it occurs only once on the page.
- Never invent an issue to appear thorough. Returning no issues is a valid and common result.
- The document is the student's own work and may be in German or English. Judge it as written; do not rewrite it in your own voice.

Respond only in the JSON shape the task specifies.`;

/**
 * A message in the layout. Kept minimal so it maps onto the SDK's shape without
 * importing its types (which the authoring machine cannot install).
 */
export interface CacheMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CachedPromptLayout {
  /** Shared, cacheable — system + document body. */
  prefix: CacheMessage[];
  /** Variable — the check-specific instruction. Always last. */
  instruction: CacheMessage;
}

/**
 * Assembles the cache-friendly message layout for a check.
 *
 * `documentBody` MUST be produced identically for every check on the same
 * upload+scope — same page selection, same joining, same whitespace — or the
 * prefix differs and the cache never hits. `buildScopedBody` in
 * `lib/checks/pageScope.ts` is the single place that builds it, precisely so
 * every check gets a byte-identical string.
 */
export function buildCachedLayout(
  documentBody: string,
  analysisInstruction: string,
): CachedPromptLayout {
  return {
    prefix: [
      { role: "system", content: SHARED_REVIEWER_SYSTEM },
      { role: "user", content: documentBody },
    ],
    instruction: { role: "user", content: analysisInstruction },
  };
}
