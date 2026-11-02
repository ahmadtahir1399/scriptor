import { RETENTION_DAYS } from "@/lib/retention/config";

/**
 * The retention purge — WHAT gets deleted, and the guarantee about what never
 * does.
 *
 * PURE. No I/O, no database. This module decides which uploads are due for a
 * purge and asserts the single most important invariant in the whole feature:
 * a purge deletes only the SOURCE (the stored file, the raw page text, the word
 * geometry) and NEVER the report (`paper_analyses`, `check_results`,
 * `findings`). The student keeps their review; only their unpublished document
 * is removed. A bug that deleted the report would destroy a year of someone's
 * work, so the forbidden set is asserted in code, here, and unit-tested.
 */

/** Tables/objects a purge is allowed to touch. */
export const PURGE_TARGETS = [
  "storage:source",
  "paper_pages.page_content",
  "words",
] as const;

/**
 * Tables a purge must NEVER delete from. The report lives here; losing it is the
 * catastrophic failure this feature is built to make impossible.
 */
export const PURGE_FORBIDDEN_TABLES = [
  "paper_analyses",
  "check_results",
  "findings",
  "papers",
  "paper_uploads",
] as const;

/**
 * Throws if a caller ever tries to purge a forbidden table. Call this with the
 * set of tables a purge is about to write to — it is the runtime backstop for
 * the never-delete-the-report invariant.
 */
export function assertPurgeTargetsSafe(tables: readonly string[]): void {
  for (const table of tables) {
    if ((PURGE_FORBIDDEN_TABLES as readonly string[]).includes(table)) {
      throw new Error(
        `Retention purge refused: "${table}" holds the student's report and must never be purged.`,
      );
    }
  }
}

export interface PurgeCandidate {
  id: string;
  filePath: string;
  autoDelete: boolean;
  createdAt: string;
  /** Whether the source content still exists (false once already purged). */
  hasContent: boolean;
}

/**
 * Selects the uploads due for a purge: auto-delete on, older than the retention
 * window, and not already purged. Already-purged uploads (no content left) are
 * excluded so a repeated sweep is idempotent and cheap.
 */
export function selectPurgeableUploads(
  candidates: readonly PurgeCandidate[],
  now: Date = new Date(),
): PurgeCandidate[] {
  const cutoff = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return candidates.filter(
    (candidate) =>
      candidate.autoDelete &&
      candidate.hasContent &&
      new Date(candidate.createdAt).getTime() < cutoff,
  );
}
