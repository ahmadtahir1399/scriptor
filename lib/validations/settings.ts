import { z } from "zod";

import { APP_LOCALES } from "@/lib/db/enums";

/** Server-action input schemas for Settings, Retention & Export. */

/** Profile fields a user may edit here. id, email and roles are NOT in this set. */
export const updateProfileSchema = z.object({
  fullName: z.string().trim().max(200).nullable().optional(),
  locale: z.enum(APP_LOCALES).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const setLocaleSchema = z.object({
  locale: z.enum(APP_LOCALES),
});
export type SetLocaleInput = z.infer<typeof setLocaleSchema>;

export const updateAnalysisDefaultsSchema = z.object({
  applyCustomChecks: z.boolean().optional(),
  defaultAutoDelete: z.boolean().optional(),
});
export type UpdateAnalysisDefaultsInput = z.infer<
  typeof updateAnalysisDefaultsSchema
>;

/** The notification-preference columns a user may toggle. */
export const NOTIFICATION_PREF_KEYS = [
  "email_analysis_complete",
  "email_analysis_failed",
  "email_reference_issues",
  "email_todo_due_soon",
  "email_weekly_digest",
  "in_app_enabled",
] as const;
export type NotificationPrefKey = (typeof NOTIFICATION_PREF_KEYS)[number];

export const updateNotificationPrefSchema = z.object({
  key: z.enum(NOTIFICATION_PREF_KEYS),
  value: z.boolean(),
});
export type UpdateNotificationPrefInput = z.infer<
  typeof updateNotificationPrefSchema
>;

/** Account-wide retention: sets the default AND applies it to existing uploads. */
export const setRetentionSchema = z.object({
  autoDelete: z.boolean(),
});
export type SetRetentionInput = z.infer<typeof setRetentionSchema>;

/**
 * Account deletion input. The confirmation must exactly match the word DELETE or
 * the account's own email — checked against the session user server-side, so a
 * client cannot bypass it.
 */
export const deleteAccountSchema = z.object({
  confirmation: z.string().min(1),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const DELETE_CONFIRMATION_WORD = "DELETE";
