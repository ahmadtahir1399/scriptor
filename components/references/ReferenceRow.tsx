"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconClock, IconRefresh } from "@/components/icons";

import { cn } from "@/lib/utils";
import type { BibliographyReference } from "@/lib/domain/reference";
import { healthTone } from "@/lib/domain/reference";
import { recheckReference } from "@/lib/references/actions";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { HealthBadge } from "@/components/references/HealthBadge";
import { ReferenceEvidence } from "@/components/references/ReferenceEvidence";

/**
 * One bibliography entry.
 *
 * Collapsed: a health dot, the reference in the student's own serif, and its
 * health badge. Expanded: the full reference, the EVIDENCE for the verdict, and
 * a one-click Recheck — because sources come back online and a recheck should
 * cost one click, not a whole re-run.
 */
export interface ReferenceRowProps {
  reference: BibliographyReference;
  analysisId: string;
}

const DOT_TONE = {
  verified: "text-verified",
  warning: "text-warning",
  critical: "text-critical",
  muted: "text-muted",
} as const;

export function ReferenceRow({ reference, analysisId }: ReferenceRowProps) {
  const t = useTranslations("analysis.references");
  const [isPending, startTransition] = React.useTransition();

  const onRecheck = (): void => {
    startTransition(async () => {
      await recheckReference({ analysisId, referenceId: reference.id });
    });
  };

  return (
    <AccordionItem value={reference.id} className="shadow-none">
      <AccordionTrigger className="gap-3">
        <IconClock
          className={cn(
            "size-2.5 shrink-0 fill-current",
            DOT_TONE[healthTone(reference.health)],
          )}
          aria-hidden="true"
        />
        <span
          className="text-ink line-clamp-2 min-w-0 flex-1 text-body"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {reference.raw_text}
        </span>
        <HealthBadge health={reference.health} className="shrink-0" />
      </AccordionTrigger>

      <AccordionContent>
        <div className="space-y-4">
          <p
            className="text-ink text-body"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {reference.raw_text}
          </p>

          <ReferenceEvidence reference={reference} />

          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRecheck}
              disabled={isPending}
            >
              <IconRefresh
                className={cn(isPending && "animate-spin")}
                aria-hidden="true"
              />
              {isPending ? t("rechecking") : t("recheck")}
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
