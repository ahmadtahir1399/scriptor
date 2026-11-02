import type { Tables } from "@/lib/db/types.generated";
import type { Profile } from "@/lib/db/queries/identity";
import type { Db } from "@/lib/db/queries/papers";
import type { NotificationPrefKey } from "@/lib/validations/settings";

/**
 * Settings, retention & export data access — P12.
 *
 * User-facing reads/writes run on the session client (RLS scopes them to the
 * caller). The purge reads/writes run under the service role in the worker.
 */

export type NotificationPreferences = Tables<"notification_preferences">;

export interface SettingsBundle {
  profile: Profile;
  preferences: NotificationPreferences;
}

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getNotificationPreferences(
  db: Db,
  userId: string,
): Promise<NotificationPreferences | null> {
  const result = await db
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return unwrap(result, "getNotificationPreferences");
}

// ---------------------------------------------------------------------------
// User-facing writes (RLS-scoped)
// ---------------------------------------------------------------------------

export async function updateNotificationPreferences(
  db: Db,
  userId: string,
  patch: Partial<Pick<NotificationPreferences, NotificationPrefKey>>,
): Promise<void> {
  const result = await db
    .from("notification_preferences")
    .update(patch)
    .eq("user_id", userId);
  if (result.error)
    throw new Error(`updateNotificationPreferences: ${result.error.message}`);
}

/**
 * Applies the account-wide auto-delete choice to the user's existing uploads.
 * The per-account default lives on `profiles`; this brings prior uploads into
 * line so the retention promise is retroactive, not only for new uploads.
 */
export async function setAllUploadsAutoDelete(
  db: Db,
  userId: string,
  value: boolean,
): Promise<void> {
  const result = await db
    .from("paper_uploads")
    .update({ auto_delete: value })
    .eq("user_id", userId);
  if (result.error)
    throw new Error(`setAllUploadsAutoDelete: ${result.error.message}`);
}

// ---------------------------------------------------------------------------
// Retention purge (service role, in the worker)
// ---------------------------------------------------------------------------

export interface PurgeUploadRow {
  id: string;
  file_path: string;
  auto_delete: boolean;
  created_at: string;
}

/** Uploads eligible for a purge sweep by age + auto_delete. */
export async function listAutoDeleteUploadsOlderThan(
  db: Db,
  cutoffIso: string,
  limit: number,
): Promise<PurgeUploadRow[]> {
  const result = await db
    .from("paper_uploads")
    .select("id, file_path, auto_delete, created_at")
    .eq("auto_delete", true)
    .lt("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  return unwrap(result, "listAutoDeleteUploadsOlderThan");
}

/** Whether an upload still has purgeable source content (word geometry). */
export async function uploadHasSourceContent(
  db: Db,
  uploadId: string,
): Promise<boolean> {
  const result = await db
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("paper_upload_id", uploadId);
  if (result.error)
    throw new Error(`uploadHasSourceContent: ${result.error.message}`);
  return (result.count ?? 0) > 0;
}

/**
 * Purges an upload's SOURCE content: nulls the raw page text and deletes the
 * word geometry. It deliberately does NOT touch paper_analyses / check_results /
 * findings — the report survives. The storage file is removed by the handler.
 */
export async function purgeUploadContent(
  db: Db,
  uploadId: string,
): Promise<void> {
  const pages = await db
    .from("paper_pages")
    .update({ page_content: "" })
    .eq("paper_upload_id", uploadId);
  if (pages.error)
    throw new Error(`purgeUploadContent(pages): ${pages.error.message}`);

  const words = await db.from("words").delete().eq("paper_upload_id", uploadId);
  if (words.error)
    throw new Error(`purgeUploadContent(words): ${words.error.message}`);
}

// ---------------------------------------------------------------------------
// Account deletion / anonymisation (service role)
// ---------------------------------------------------------------------------

/** Strips PII from a profile, keeping the row for aggregate integrity. */
export async function anonymiseProfile(db: Db, userId: string): Promise<void> {
  const result = await db
    .from("profiles")
    .update({
      full_name: null,
      avatar_url: null,
      email: `anon+${userId}@deleted.scriptor.app`,
      is_anonymized: true,
      anonymized_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (result.error)
    throw new Error(`anonymiseProfile: ${result.error.message}`);
}

/** Records a privileged account action in the append-only audit log. */
export async function recordAdminAction(
  db: Db,
  args: {
    actorUserId: string;
    targetUserId: string;
    action: Tables<"admin_actions">["action"];
    reason?: string;
  },
): Promise<void> {
  const result = await db.from("admin_actions").insert({
    actor_user_id: args.actorUserId,
    target_user_id: args.targetUserId,
    action: args.action,
    target_table: "auth.users",
    target_id: args.targetUserId,
    reason: args.reason ?? null,
  });
  if (result.error)
    throw new Error(`recordAdminAction: ${result.error.message}`);
}
