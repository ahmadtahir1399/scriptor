"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconAlert } from "@/components/icons";

/**
 * Rendered by every `error.tsx` in the app.
 *
 * The icon circle is critical-tinted rather than navy — this is the one place
 * the empty-state shape is reused to say "something is wrong" instead of
 * "nothing here yet".
 */
export interface ErrorStateProps {
  title: string;
  description?: string;
  /** Usually the `reset` function handed to an error boundary. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Next.js error digest, shown small so users can quote it in support. */
  digest?: string;
  className?: string;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  digest,
  className,
}: ErrorStateProps) {
  const t = useTranslations();

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <div className="bg-critical-soft flex size-12 items-center justify-center rounded-full">
        <IconAlert
          className="text-critical size-5"
          aria-hidden="true"
        />
      </div>

      <p className="text-section-title text-ink mt-4">{title}</p>

      {description ? (
        <p className="text-body text-muted mt-1 max-w-sm">{description}</p>
      ) : null}

      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          {retryLabel ?? t("common.retry")}
        </Button>
      ) : null}

      {digest ? (
        <p className="text-micro text-muted mt-4 font-mono normal-case">
          {t("errors.digest", { digest })}
        </p>
      ) : null}
    </div>
  );
}
