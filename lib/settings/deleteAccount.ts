import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { anonymiseProfile, recordAdminAction } from "@/lib/db/queries/settings";

/**
 * The two account-closure paths, run under the service role.
 *
 * HARD DELETE removes the auth user; the schema's ON DELETE CASCADE from
 * auth.users then tears down the profile, papers, uploads, analyses, findings,
 * requirements, todos and files — everything. ANONYMISE is the softer path: it
 * strips PII from the profile but keeps the rows, per the ANONYMIZE_USER action.
 *
 * Both are audited FIRST (the log row survives the deletion because
 * admin_actions.target_user_id is ON DELETE SET NULL), then executed.
 */

export async function hardDeleteAccount(userId: string): Promise<void> {
  const admin = createAdminClient();

  // Audit before the cascade wipes the user, so the record persists.
  await recordAdminAction(admin, {
    actorUserId: userId,
    targetUserId: userId,
    action: "DELETE_USER",
    reason: "User requested permanent account deletion.",
  });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`hardDeleteAccount: ${error.message}`);
}

export async function anonymiseAccount(userId: string): Promise<void> {
  const admin = createAdminClient();

  await recordAdminAction(admin, {
    actorUserId: userId,
    targetUserId: userId,
    action: "ANONYMIZE_USER",
    reason: "User requested account anonymisation.",
  });

  await anonymiseProfile(admin, userId);
}
