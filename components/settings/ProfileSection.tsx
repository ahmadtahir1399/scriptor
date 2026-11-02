"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconCheck } from "@/components/icons";

import { useRouter } from "@/i18n/routing";
import type { Profile } from "@/lib/db/queries/identity";
import { APP_LOCALES, type AppLocale } from "@/lib/db/enums";
import { setLocale, updateProfileAction } from "@/lib/settings/actions";
import { SectionCard } from "@/components/shared/SectionCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Name, email (read-only), language and avatar initial. Email is deliberately
 * not editable here — changing it is a separate verified flow — so the field is
 * shown with a quiet "contact us" note rather than an input.
 */
export interface ProfileSectionProps {
  profile: Profile;
}

export function ProfileSection({ profile }: ProfileSectionProps) {
  const t = useTranslations("settings.profile");
  const router = useRouter();
  const [name, setName] = React.useState(profile.full_name ?? "");
  const [status, setStatus] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isPending, startTransition] = React.useTransition();

  const initial = (
    profile.full_name?.trim()?.[0] ??
    profile.email[0] ??
    "?"
  ).toUpperCase();
  const dirty = name.trim() !== (profile.full_name ?? "").trim();

  const onSaveName = (): void => {
    setStatus("saving");
    startTransition(async () => {
      const result = await updateProfileAction({
        fullName: name.trim() || null,
      });
      setStatus(result.ok ? "saved" : "error");
    });
  };

  const onLocale = (value: string): void => {
    startTransition(async () => {
      await setLocale({ locale: value as AppLocale });
      router.refresh();
    });
  };

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="bg-primary-soft text-primary flex size-12 items-center justify-center rounded-full text-section-title font-semibold">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-body text-ink font-medium">
              {profile.full_name || t("noName")}
            </p>
            <p className="text-meta text-muted truncate">{profile.email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-name">{t("nameLabel")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="settings-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setStatus("idle");
              }}
              maxLength={200}
              className="max-w-sm"
            />
            <Button
              size="sm"
              onClick={onSaveName}
              disabled={!dirty || isPending}
            >
              {status === "saving" ? t("saving") : t("save")}
            </Button>
            {status === "saved" ? (
              <span className="text-verified inline-flex items-center gap-1 text-meta">
                <IconCheck className="size-3.5" aria-hidden="true" />
                {t("saved")}
              </span>
            ) : null}
            {status === "error" ? (
              <span className="text-critical text-meta">{t("saveError")}</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-email">{t("emailLabel")}</Label>
          <Input
            id="settings-email"
            value={profile.email}
            readOnly
            disabled
            className="max-w-sm"
          />
          <p className="text-meta text-muted">{t("emailNote")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-language">{t("languageLabel")}</Label>
          <Select
            value={profile.locale}
            onValueChange={onLocale}
            disabled={isPending}
          >
            <SelectTrigger id="settings-language" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APP_LOCALES.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {t(`language.${locale}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SectionCard>
  );
}
