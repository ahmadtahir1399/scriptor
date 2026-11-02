import type { Tables } from "@/lib/db/types.generated";
import type { NotificationType } from "@/lib/db/enums";

/** Notification aggregate — P15. */

export type Notification = Tables<"notifications">;
export type NotificationPreferences = Tables<"notification_preferences">;

export function isUnread(notification: Notification): boolean {
  return notification.read_at === null;
}

export function countUnread(notifications: readonly Notification[]): number {
  return notifications.filter(isUnread).length;
}

/**
 * Maps a notification type onto the app's semantic colour contract.
 * navy = neutral/system, green = good news, amber = review this, red = problem.
 */
export function notificationTone(
  type: NotificationType,
): "primary" | "verified" | "warning" | "critical" {
  switch (type) {
    case "ANALYSIS_COMPLETE":
      return "verified";
    case "ANALYSIS_FAILED":
      return "critical";
    case "UPLOAD_INCOMPATIBLE":
      return "critical";
    case "REFERENCE_ISSUES_FOUND":
      return "warning";
    case "TODO_DUE_SOON":
      return "warning";
    case "REQUIREMENTS_EXTRACTED":
      return "primary";
  }
}

/** Which preference column gates the email for each notification type. */
const EMAIL_PREFERENCE_COLUMN = {
  ANALYSIS_COMPLETE: "email_analysis_complete",
  ANALYSIS_FAILED: "email_analysis_failed",
  UPLOAD_INCOMPATIBLE: "email_analysis_failed",
  REFERENCE_ISSUES_FOUND: "email_reference_issues",
  TODO_DUE_SOON: "email_todo_due_soon",
  REQUIREMENTS_EXTRACTED: "email_analysis_complete",
} as const satisfies Record<NotificationType, keyof NotificationPreferences>;

/**
 * Whether an email should be sent for this notification.
 *
 * Defaults to true when preferences are missing: a user whose preferences row
 * failed to create should still be told their analysis finished. Silence is the
 * worse failure mode here.
 */
export function shouldEmail(
  type: NotificationType,
  preferences: NotificationPreferences | null,
): boolean {
  if (!preferences) return true;
  return preferences[EMAIL_PREFERENCE_COLUMN[type]];
}
