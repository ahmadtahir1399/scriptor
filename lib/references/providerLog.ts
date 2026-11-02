import "server-only";

import type { ProviderName } from "@/lib/validations/reference";

/**
 * External-provider call log.
 *
 * Every request to Crossref, OpenAlex, Semantic Scholar, Open Library or
 * doi.org is recorded here — the reference feature's analogue of `token_usage`
 * for the LLM. There is no dedicated table (no migration ships with this
 * prompt), so this writes structured lines to the server log, which is where
 * external-call debugging actually happens.
 *
 * WHAT IS LOGGED IS DELIBERATELY NARROW. Only the reference string, DOI, URL or
 * search query — all of which are public bibliographic data — plus timing and
 * outcome. Never the surrounding thesis text, never the student's identity,
 * never a user id. If you find yourself adding either to a log line, stop: the
 * whole privacy story of this feature is that only the reference leaves the app.
 */

export type ProviderOutcome =
  "hit" | "miss" | "error" | "timeout" | "rate_limited";

export interface ProviderLogEntry {
  provider: ProviderName;
  /** What was looked up — a DOI, ISBN, URL or search query. Public data only. */
  target: string;
  outcome: ProviderOutcome;
  /** HTTP status, when the request completed. */
  status?: number;
  latencyMs: number;
  /** Optional short note (e.g. "no match", "404"). Never the document text. */
  note?: string;
}

/**
 * Records one external call. Never throws — a logging failure must not take
 * down a verification job the way a lost cost row must not take down an
 * analysis.
 */
export function logProviderCall(entry: ProviderLogEntry): void {
  try {
    // A single-line, greppable record. `[provider]` prefix mirrors the other
    // subsystems' log conventions (`[worker]`, `[kick]`, `[tokenUsage]`).
    console.info(
      `[provider] ${entry.provider} ${entry.outcome} ` +
        `status=${entry.status ?? "-"} ${entry.latencyMs}ms ` +
        `target=${truncateTarget(entry.target)}` +
        (entry.note ? ` note=${entry.note}` : ""),
    );
  } catch {
    // Logging is best-effort; swallow anything the console throws.
  }
}

/**
 * Bounds the logged target. A reference string can be long; the log needs
 * enough to identify the call, not the whole entry.
 */
function truncateTarget(target: string): string {
  const collapsed = target.replace(/\s+/g, " ").trim();
  return collapsed.length > 160 ? `${collapsed.slice(0, 157)}...` : collapsed;
}
