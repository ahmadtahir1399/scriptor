"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconMailCheck } from "@/components/icons";

import { resendOtp } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Magic-link confirmation.
 *
 * Replaces the 6-digit OTP entry. The sign-in action sends a magic link (that
 * is what `signInWithOtp` with `emailRedirectTo` produces — Supabase's built-in
 * email, no SMTP needed), so there is no code to type: the student clicks the
 * link in their inbox and `/auth/callback` establishes the session.
 *
 * The OTP code path is still present in `lib/auth/actions.ts` (`verifyOtp`) and
 * `components/ui/input-otp.tsx`; it is simply not wired up. To switch back once
 * SMTP / a token email template exists, restore the OTP form here and route the
 * sign-in form to it.
 */
const RESEND_SECONDS = 60;

export interface MagicLinkNoticeProps {
  email: string;
}

export function MagicLinkNotice({ email }: MagicLinkNoticeProps) {
  const t = useTranslations("auth.verify");
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_SECONDS);
  const [pending, startTransition] = React.useTransition();
  const [resent, setResent] = React.useState(false);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const onResend = () => {
    startTransition(async () => {
      await resendOtp(email);
      setSecondsLeft(RESEND_SECONDS);
      setResent(true);
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="bg-primary-soft flex size-12 items-center justify-center rounded-full">
        <IconMailCheck className="text-primary size-5" aria-hidden="true" />
      </div>

      <p className="text-body text-muted">{t("hint")}</p>

      {resent ? <p className="text-meta text-verified">{t("resent")}</p> : null}

      <Button
        variant="ghost"
        onClick={onResend}
        disabled={pending || secondsLeft > 0}
        className="w-full"
      >
        {secondsLeft > 0
          ? t("resendIn", { seconds: secondsLeft })
          : t("resend")}
      </Button>

      <ButtonLink href="/sign-in" variant="ghost" className="w-full">
        {t("differentEmail")}
      </ButtonLink>
    </div>
  );
}
