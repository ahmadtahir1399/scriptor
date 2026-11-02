"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { toggleNotification } from "@/lib/settings/actions";
import { useOptimisticToggle } from "@/hooks/useSettings";
import type { NotificationPreferences } from "@/lib/db/queries/settings";
import {
  NOTIFICATION_PREF_KEYS,
  type NotificationPrefKey,
} from "@/lib/validations/settings";
import { SectionCard } from "@/components/shared/SectionCard";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Per-user delivery settings, backed by the real `notification_preferences`
 * columns P13 reads before sending anything. Each row is an optimistic toggle.
 * Transactional/security emails aren't listed — they can't be disabled.
 */
export interface NotificationPrefsSectionProps {
  preferences: NotificationPreferences;
}

function PrefToggle({
  prefKey,
  initial,
}: {
  prefKey: NotificationPrefKey;
  initial: boolean;
}) {
  const t = useTranslations("settings.notifications");
  const toggle = useOptimisticToggle(initial, (value) =>
    toggleNotification({ key: prefKey, value }),
  );

  return (
    <label className="flex items-start gap-3">
      <Checkbox
        className="mt-0.5"
        checked={toggle.value}
        onCheckedChange={(v) => toggle.toggle(v === true)}
      />
      <span>
        <span className="text-body text-ink block">
          {t(`pref.${prefKey}.label`)}
        </span>
        <span className="text-meta text-muted block">
          {t(`pref.${prefKey}.hint`)}
        </span>
      </span>
    </label>
  );
}

export function NotificationPrefsSection({
  preferences,
}: NotificationPrefsSectionProps) {
  const t = useTranslations("settings.notifications");

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-4">
        {NOTIFICATION_PREF_KEYS.map((key) => (
          <PrefToggle key={key} prefKey={key} initial={preferences[key]} />
        ))}
        <p className="text-meta text-muted border-border border-t pt-3">
          {t("transactionalNote")}
        </p>
      </div>
    </SectionCard>
  );
}
