"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";
import type { AppLocale } from "@/lib/db/enums";
import { checkName } from "@/lib/domain/check";
import type { CheckResultWithVersion } from "@/lib/domain/analysis";
import {
  displayFindingsForResult,
  scoreTone,
  type ScoreTone,
} from "@/lib/analysis/presentation";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StatusPill } from "@/components/shared/StatusPill";
import { CheckFindingItem } from "@/components/analysis/CheckFindingItem";
import { CheckResultError } from "@/components/analysis/CheckResultError";
import { HelpfulnessControl } from "@/components/analysis/HelpfulnessControl";

/**
 * One check's result card.
 *
 * Collapsed while queued or working (a StatusPill and a shimmering rating slot);
 * on expand once done, the feedback markdown and the findings list. A brief
 * highlight flash marks the working → done transition, so the student sees the
 * report "develop" rather than snap. An errored check renders its retry card
 * inline and never blocks the others.
 */
export interface CheckResultCardProps {
  result: CheckResultWithVersion;
  analysisId: string;
}

const RATING_TONE: Record<ScoreTone, string> = {
  critical: "bg-critical-soft text-critical",
  warning: "bg-warning-soft text-warning",
  verified: "bg-verified-soft text-verified",
  muted: "bg-bg text-muted",
};

export function CheckResultCard({ result, analysisId }: CheckResultCardProps) {
  const t = useTranslations("analysis.check");
  const locale = useLocale().toUpperCase() as AppLocale;

  // The check comes from the join on `checks_public` — no separate lookup.
  const check = result.check;
  const name = check ? checkName(check, locale) : t("unknown");

  // One-shot settle flash when the card flips to DONE.
  const prevStatus = React.useRef(result.status);
  const [justSettled, setJustSettled] = React.useState(false);
  React.useEffect(() => {
    if (prevStatus.current !== "DONE" && result.status === "DONE") {
      setJustSettled(true);
      const timer = setTimeout(() => setJustSettled(false), 1200);
      prevStatus.current = result.status;
      return () => clearTimeout(timer);
    }
    prevStatus.current = result.status;
  }, [result.status]);

  const isDone = result.status === "DONE";
  const isError = result.status === "ERROR";
  const findings = isDone ? displayFindingsForResult(analysisId, result) : [];
  const ratingTone = scoreTone(result.score);

  return (
    <AccordionItem
      value={result.check_id}
      id={`check-${result.check_id}`}
      className={cn("scroll-mt-24", justSettled && "animate-card-settle")}
    >
      <AccordionTrigger
        // Collapsing is pointless before the result exists — disable it.
        disabled={!isDone && !isError}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="text-body text-ink truncate font-medium">
            {name}
          </span>

          {isDone && findings.length > 0 ? (
            <span className="text-meta text-muted shrink-0">
              {t("findingCount", { count: findings.length })}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDone && result.score !== null ? (
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 text-micro font-medium tabular-nums",
                RATING_TONE[ratingTone],
              )}
            >
              {Math.round(result.score)}
            </span>
          ) : null}
          {!isDone && !isError ? (
            <span
              className="bg-border/60 h-5 w-8 animate-pulse rounded-sm"
              aria-hidden="true"
            />
          ) : null}
          <StatusPill status={result.status} size="sm" />
        </div>
      </AccordionTrigger>

      <AccordionContent>
        {isError ? (
          <CheckResultError
            checkResultId={result.id}
            reason={result.error_message}
          />
        ) : isDone ? (
          <div>
            {result.feedback ? (
              <div className="text-body text-ink prose-report">
                <ReactMarkdown>{result.feedback}</ReactMarkdown>
              </div>
            ) : null}

            {findings.length > 0 ? (
              <ul className="mt-4">
                {findings.map((finding) => (
                  <CheckFindingItem key={finding.key} finding={finding} />
                ))}
              </ul>
            ) : null}

            <HelpfulnessControl
              checkResultId={result.id}
              initialIsHelpful={result.is_helpful}
              initialComment={result.user_comment}
            />
          </div>
        ) : (
          <p className="text-meta text-muted">{t("workingHint")}</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
