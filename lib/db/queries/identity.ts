import type { AppRole } from "@/lib/db/enums";
import type { Tables } from "@/lib/db/types.generated";
import type { Db } from "@/lib/db/queries/papers";

/**
 * Identity aggregate reads.
 *
 * Added in P2. Follows the same rule as every other file in this directory:
 * all table access lives here, so no component or action anywhere writes an
 * inline `.from(...)`.
 */

export type Profile = Tables<"profiles">;

function unwrap<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Roles held by a user.
 *
 * Returns an empty array rather than throwing when the read fails. A role
 * lookup that errors must degrade to "no privileges", never to "assume
 * privileged" — failing closed is the only safe direction for an
 * authorisation check.
 */
export async function getUserRoles(db: Db, userId: string): Promise<AppRole[]> {
  const result = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (result.error) {
    console.error(
      "[identity] role lookup failed, treating as unprivileged",
      result.error,
    );
    return [];
  }

  return (result.data ?? []).map((row) => row.role);
}

export async function getProfile(
  db: Db,
  userId: string,
): Promise<Profile | null> {
  const result = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return unwrap(result, "getProfile");
}

export async function updateProfile(
  db: Db,
  userId: string,
  patch: Partial<
    Pick<
      Profile,
      | "full_name"
      | "avatar_url"
      | "locale"
      | "institution_id"
      | "apply_custom_checks_by_default"
      | "default_auto_delete"
    >
  >,
): Promise<void> {
  const result = await db.from("profiles").update(patch).eq("id", userId);
  if (result.error) {
    throw new Error(`updateProfile: ${result.error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Rate limiting. Service-role client only — `rate_limit_attempts` has RLS on
// and no user policy.
// ---------------------------------------------------------------------------

export async function countRecentAttempts(
  db: Db,
  bucket: string,
  identifier: string,
  since: Date,
): Promise<number> {
  // Head-only count: the caller needs a number, not the rows.
  const result = await db
    .from("rate_limit_attempts")
    .select("*", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("identifier", identifier)
    .gte("attempted_at", since.toISOString());

  if (result.error) {
    throw new Error(`countRecentAttempts: ${result.error.message}`);
  }
  return result.count ?? 0;
}

export async function recordAttempt(
  db: Db,
  bucket: string,
  identifier: string,
  succeeded = false,
): Promise<void> {
  const result = await db
    .from("rate_limit_attempts")
    .insert({ bucket, identifier, succeeded });

  if (result.error) {
    throw new Error(`recordAttempt: ${result.error.message}`);
  }
}
