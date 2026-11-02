"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { IconThumbDown, IconThumbUp } from "@/components/icons";

import { cn } from "@/lib/utils";
import { useCheckFeedback } from "@/hooks/useCheckFeedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * The quiet "Was this helpful?" control on every check card.
 *
 * This is the eval signal the prompt-improvement loop (P15/P16) runs on, so it
 * is captured on every card from day one. Thumbs-down reveals an optional
 * one-line comment; the write is optimistic and ownership-validated server-side.
 */
export interface HelpfulnessControlProps {
  checkResultId: string;
  initialIsHelpful: boolean | null;
  initialComment: string | null;
}

export function HelpfulnessControl({
  checkResultId,
  initialIsHelpful,
  initialComment,
}: HelpfulnessControlProps) {
  const t = useTranslations("analysis.helpfulness");
  const { isHelpful, pending, setHelpful } = useCheckFeedback(
    checkResultId,
    initialIsHelpful,
  );
  const [comment, setComment] = React.useState(initialComment ?? "");
  const [showComment, setShowComment] = React.useState(false);

  const onThumbsDown = () => {
    setHelpful(false);
    setShowComment(true);
  };

  const onSubmitComment = () => {
    setHelpful(false, comment.trim() || null);
    setShowComment(false);
  };

  return (
    <div className="border-border mt-4 flex flex-col gap-2 border-t pt-3">
      <div className="flex items-center gap-2">
        <span className="text-meta text-muted">{t("prompt")}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-pressed={isHelpful === true}
            aria-label={t("yes")}
            onClick={() => setHelpful(true)}
            className={cn(isHelpful === true && "text-verified")}
          >
            <IconThumbUp aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-pressed={isHelpful === false}
            aria-label={t("no")}
            onClick={onThumbsDown}
            className={cn(isHelpful === false && "text-critical")}
          >
            <IconThumbDown aria-hidden="true" />
          </Button>
        </div>
      </div>

      {showComment ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("commentPlaceholder")}
            maxLength={1000}
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComment(false)}
            >
              {t("skip")}
            </Button>
            <Button size="sm" onClick={onSubmitComment} disabled={pending}>
              {t("send")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
