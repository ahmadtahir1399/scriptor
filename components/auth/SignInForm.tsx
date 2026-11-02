"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { IconAlert, IconSpinner } from "@/components/icons";
import type { z } from "zod";

import { useRouter } from "@/i18n/routing";
import { signInSchema } from "@/lib/validations/auth";
import { requestOtp } from "@/lib/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type SignInValues = z.infer<typeof signInSchema>;

export interface SignInFormProps {
  /** Relative path to return to after sign-in. */
  next?: string;
}

export function SignInForm({ next }: SignInFormProps) {
  const t = useTranslations("auth.signIn");
  const router = useRouter();
  const [rateLimited, setRateLimited] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const onSubmit = (values: SignInValues) => {
    setRateLimited(false);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", values.email);

      const result = await requestOtp(formData);

      if (!result.ok && result.error === "rate_limited") {
        setRateLimited(true);
        return;
      }

      if (!result.ok) {
        form.setError("email", { message: t("invalidEmail") });
        return;
      }

      /*
       * Navigates on success AND on "no such account" — the action returns an
       * identical result for both, so this page cannot be used to discover
       * which addresses are registered.
       */
      const params = new URLSearchParams({ email: values.email });
      if (next) params.set("next", next);
      router.push(`/sign-in/verify?${params.toString()}`);
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        {rateLimited ? (
          <Alert variant="warning">
            <IconAlert />
            <AlertDescription>{t("rateLimited")}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("emailLabel")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  placeholder={t("emailPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <IconSpinner className="animate-spin" /> : null}
          {t("continue")}
        </Button>
      </form>
    </Form>
  );
}
