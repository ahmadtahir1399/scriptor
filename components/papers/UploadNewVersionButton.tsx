"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconUpload } from "@/components/icons";

import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Starts a NEW VERSION of an existing paper.
 *
 * Reuses P2's upload flow rather than forking it — the link carries `?paperId`,
 * which the upload wizard passes to `prepareUpload` so the new immutable upload
 * is bound to this paper (and becomes its current version) instead of creating a
 * brand-new paper.
 */
export interface UploadNewVersionButtonProps {
  paperId: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}

export function UploadNewVersionButton({
  paperId,
  variant = "default",
  size = "default",
  className,
}: UploadNewVersionButtonProps) {
  const t = useTranslations("papers.actions");

  return (
    <ButtonLink
      href={`/upload?paperId=${paperId}`}
      variant={variant}
      size={size}
      className={className}
    >
      <IconUpload aria-hidden="true" />
      {t("newVersion")}
    </ButtonLink>
  );
}
