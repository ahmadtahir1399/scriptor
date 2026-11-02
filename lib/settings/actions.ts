"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { requireSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOCALE_COOKIE } from "@/lib/constants";
import { getProfile, updateProfile } from "@/lib/db/queries/identity";
import type { Profile } from "@/lib/db/queries/identity";
import {
  getNotificationPreferences,
  setAllUploadsAutoDelete,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/db/queries/settings";
import { countRecentAttempts, recordAttempt } from "@/lib/db/queries/identity";
import { buildExportBundle } from "@/lib/settings/export";
import {
  anonymiseAccount,
  hardDeleteAccount,
} from "@/lib/settings/deleteAccount";
import { EXPORT_RATE_LIMIT } from "@/lib/retention/config";
import {
  DELETE_CONFIRMATION_WORD,
  deleteAccountSchema,
  setLocaleSchema,
  setRetentionSchema,
  updateAnalysisDefaultsSchema,
  updateNotificationPrefSchema,
  updateProfileSchema,
} from "@/lib/validations/settings";

/**
 * Settings, retention & export server actions.
 *
 * Every write re-derives the user from the session and is RLS-scoped to them —
 * a user can only ever change their own settings. Profile writes go through the
 * server-side allowlist (`updateProfile`), which cannot touch id, email or
 * roles. The destructive account actions run under the service role and are
 * gated by typed confirmation checked against the session here.
 */

export type SettingsResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export interface SettingsData {
  profile: Profile;
  preferences: NotificationPreferences | null;
}

export async function getSettings(): Promise<SettingsData | null> {
  const user = await requireSessionUser();
  const db = await createClient();
  const profile = await getProfile(db, user.id);
  if (!profile) return null;
  const preferences = await getNotificationPreferences(db, user.id);
  return { profile, preferences };
}

// ---------------------------------------------------------------------------
// Profile / preferences / defaults
// ---------------------------------------------------------------------------

export async function updateProfileAction(
  input: unknown,
): Promise<SettingsResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();
    await updateProfile(db, user.id, {
      ...(parsed.data.fullName !== undefined
        ? { full_name: parsed.data.fullName }
        : {}),
      ...(parsed.data.locale !== undefined
        ? { locale: parsed.data.locale }
        : {}),
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    console.error("[settings] updateProfile failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function setLocale(input: unknown): Promise<SettingsResult> {
  const parsed = setLocaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();
    await updateProfile(db, user.id, { locale: parsed.data.locale });

    // Drive P0's locale routing: the cookie next-intl reads, plus the stored
    // preference so it survives across devices.
    const store = await cookies();
    store.set(LOCALE_COOKIE, parsed.data.locale.toLowerCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[settings] setLocale failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function updateAnalysisDefaults(
  input: unknown,
): Promise<SettingsResult> {
  const parsed = updateAnalysisDefaultsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();
    await updateProfile(db, user.id, {
      ...(parsed.data.applyCustomChecks !== undefined
        ? { apply_custom_checks_by_default: parsed.data.applyCustomChecks }
        : {}),
      ...(parsed.data.defaultAutoDelete !== undefined
        ? { default_auto_delete: parsed.data.defaultAutoDelete }
        : {}),
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    console.error("[settings] updateAnalysisDefaults failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function toggleNotification(
  input: unknown,
): Promise<SettingsResult> {
  const parsed = updateNotificationPrefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();
    await updateNotificationPreferences(db, user.id, {
      [parsed.data.key]: parsed.data.value,
    });
    return { ok: true };
  } catch (error) {
    console.error("[settings] toggleNotification failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

export async function setRetention(input: unknown): Promise<SettingsResult> {
  const parsed = setRetentionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const user = await requireSessionUser();
    const db = await createClient();
    // The account default AND every existing upload, so the promise is retroactive.
    await updateProfile(db, user.id, {
      default_auto_delete: parsed.data.autoDelete,
    });
    await setAllUploadsAutoDelete(db, user.id, parsed.data.autoDelete);
    revalidatePath("/settings/data");
    return { ok: true };
  } catch (error) {
    console.error("[settings] setRetention failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function signOutEverywhere(): Promise<SettingsResult> {
  try {
    await requireSessionUser();
    const db = await createClient();
    // Global scope revokes every refresh token, signing out all devices.
    await db.auth.signOut({ scope: "global" });
    return { ok: true };
  } catch (error) {
    console.error("[settings] signOutEverywhere failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; error: "rate_limited" | "unknown" };

export async function requestExport(): Promise<ExportResult> {
  try {
    const user = await requireSessionUser();
    const db = await createClient();
    const admin = createAdminClient();

    const since = new Date(
      Date.now() - EXPORT_RATE_LIMIT.windowMinutes * 60 * 1000,
    );
    const recent = await countRecentAttempts(
      admin,
      EXPORT_RATE_LIMIT.bucket,
      user.id,
      since,
    );
    if (recent >= EXPORT_RATE_LIMIT.maxPerWindow)
      return { ok: false, error: "rate_limited" };
    await recordAttempt(admin, EXPORT_RATE_LIMIT.bucket, user.id, true);

    const bundle = await buildExportBundle(db, user.id);
    return {
      ok: true,
      filename: `scriptor-export-${new Date().toISOString().slice(0, 10)}.json`,
      json: JSON.stringify(bundle, null, 2),
    };
  } catch (error) {
    console.error("[settings] requestExport failed", error);
    return { ok: false, error: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Account closure
// ---------------------------------------------------------------------------

export async function deleteAccount(input: unknown): Promise<SettingsResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    // Re-derive the user — a stale/absent session cannot delete an account.
    const user = await requireSessionUser();

    const confirmation = parsed.data.confirmation.trim();
    const matches =
      confirmation === DELETE_CONFIRMATION_WORD ||
      confirmation.toLowerCase() === user.email.toLowerCase();
    if (!matches) return { ok: false, error: "confirmation" };

    await hardDeleteAccount(user.id);

    // The auth user is gone; clearing the local session cookie is best-effort.
    const db = await createClient();
    await db.auth.signOut().catch(() => undefined);
    return { ok: true };
  } catch (error) {
    console.error("[settings] deleteAccount failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function anonymiseAccountAction(): Promise<SettingsResult> {
  try {
    const user = await requireSessionUser();
    await anonymiseAccount(user.id);

    const db = await createClient();
    await db.auth.signOut({ scope: "global" }).catch(() => undefined);
    return { ok: true };
  } catch (error) {
    console.error("[settings] anonymiseAccount failed", error);
    return { ok: false, error: "unknown" };
  }
}
