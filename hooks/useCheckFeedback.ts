"use client";

import * as React from "react";

import { submitHelpfulness } from "@/lib/analysis/feedbackActions";

/**
 * Helpfulness capture for one check card.
 *
 * Optimistic: the thumb state updates immediately and reverts only if the write
 * fails. Losing a feedback signal to a network blip is acceptable; making the
 * student wait on a round trip to see their own click is not.
 */
export interface HelpfulnessState {
  isHelpful: boolean | null;
  pending: boolean;
  setHelpful: (value: boolean, comment?: string | null) => void;
}

export function useCheckFeedback(
  checkResultId: string,
  initial: boolean | null,
): HelpfulnessState {
  const [isHelpful, setIsHelpful] = React.useState<boolean | null>(initial);
  const [pending, startTransition] = React.useTransition();

  const setHelpful = React.useCallback(
    (value: boolean, comment: string | null = null) => {
      const previous = isHelpful;
      // Toggling the active thumb clears the rating.
      const next = previous === value ? null : value;
      setIsHelpful(next);

      startTransition(async () => {
        const result = await submitHelpfulness({
          checkResultId,
          isHelpful: next,
          comment: next === false ? comment : null,
        });
        if (!result.ok) {
          setIsHelpful(previous); // revert
        }
      });
    },
    [checkResultId, isHelpful],
  );

  return { isHelpful, pending, setHelpful };
}
