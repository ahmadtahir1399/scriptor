import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { PAPERS_BUCKET } from "@/lib/upload/constants";
import { PURGE_BATCH_SIZE, RETENTION_DAYS } from "@/lib/retention/config";
import {
  PURGE_TARGETS,
  assertPurgeTargetsSafe,
  selectPurgeableUploads,
} from "@/lib/retention/purge";
import {
  listAutoDeleteUploadsOlderThan,
  purgeUploadContent,
  uploadHasSourceContent,
} from "@/lib/db/queries/settings";

/**
 * The retention purge sweep.
 *
 * NOTE ON SCHEDULING: this is NOT an `analysis_jobs` handler — that queue's
 * paper_analysis_id / paper_upload_id are NOT NULL and a purge is an
 * account-wide sweep with neither. Instead it runs inside the existing worker
 * route (already cron-triggered), reusing the worker rather than adding a second
 * scheduler.
 *
 * THE INVARIANT: a purge removes only the SOURCE — the stored file, the raw page
 * text, the word geometry — and NEVER the report (paper_analyses /
 * check_results / findings). That guarantee is asserted here before any deletion
 * and unit-tested in `lib/retention/__tests__/purge.test.ts`. Idempotent: an
 * already-purged upload has no content left and is skipped, so repeat runs are
 * cheap and safe.
 */
export async function runRetentionPurge(): Promise<{ purged: number }> {
  // Assert the never-delete-the-report invariant up front. PURGE_TARGETS is the
  // exhaustive set this sweep may write to; if it ever grew to include a report
  // table, this throws before a single row is touched.
  assertPurgeTargetsSafe([...PURGE_TARGETS]);

  const db = createAdminClient();
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rows = await listAutoDeleteUploadsOlderThan(
    db,
    cutoff,
    PURGE_BATCH_SIZE,
  );
  const candidates = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      filePath: row.file_path,
      autoDelete: row.auto_delete,
      createdAt: row.created_at,
      hasContent: await uploadHasSourceContent(db, row.id),
    })),
  );

  const due = selectPurgeableUploads(candidates);
  let purged = 0;

  for (const upload of due) {
    try {
      // 1. The source file. 2. The raw page text + word geometry. The report
      //    tables are never referenced here.
      await db.storage.from(PAPERS_BUCKET).remove([upload.filePath]);
      await purgeUploadContent(db, upload.id);
      purged += 1;
    } catch (error) {
      console.error(`[retention] purge failed for upload ${upload.id}`, error);
    }
  }

  if (purged > 0)
    console.info(`[retention] purged ${purged} source document(s)`);
  return { purged };
}
