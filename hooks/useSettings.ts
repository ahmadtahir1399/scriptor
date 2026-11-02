"use client";

import * as React from "react";

/**
 * Optimistic boolean setting.
 *
 * The shared primitive behind every toggle on the Settings pages: the switch
 * flips instantly, the write happens in the background, and it rolls back to its
 * previous value if the save fails. A settings toggle must never feel laggy.
 */
export interface OptimisticToggle {
  value: boolean;
  pending: boolean;
  toggle: (next: boolean) => void;
}

export function useOptimisticToggle(
  initial: boolean,
  save: (value: boolean) => Promise<{ ok: boolean }>,
): OptimisticToggle {
  const [value, setValue] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  const toggle = React.useCallback(
    (next: boolean) => {
      const previous = value;
      setValue(next);
      startTransition(async () => {
        const result = await save(next);
        if (!result.ok) setValue(previous);
      });
    },
    [value, save],
  );

  return { value, pending, toggle };
}
