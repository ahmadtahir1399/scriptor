/**
 * Retention & export configuration.
 *
 * The 90-day window the privacy policy promises, and the export rate limit,
 * stated once here rather than scattered as magic numbers.
 */

/** Source documents auto-delete this many days after upload. */
export const RETENTION_DAYS = 90;

/** How many uploads one purge sweep processes, so a backlog cannot run away. */
export const PURGE_BATCH_SIZE = 50;

/** Data export is expensive to assemble — cap how often a user can request it. */
export const EXPORT_RATE_LIMIT = {
  bucket: "data_export",
  maxPerWindow: 3,
  windowMinutes: 60,
} as const;
