"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getPapersLibrary } from "@/lib/papers/actions";
import type { PaperCardView } from "@/lib/papers/presentation";
import { createClient } from "@/lib/supabase/client";

/**
 * Live papers library.
 *
 * Server-rendered `initial` seeds first paint — a returning student sees their
 * papers instantly, never a spinner. Realtime on `paper_analyses` keeps any
 * still-running card's status live; the polling fallback only ticks while the
 * socket is down and something is actually generating.
 */
export interface PapersLibraryValue {
  papers: PaperCardView[];
  isConnected: boolean;
}

export function usePapers(initial: PaperCardView[], userId: string): PapersLibraryValue {
  const [isConnected, setIsConnected] = React.useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["papers-library"],
    queryFn: () => getPapersLibrary(),
    initialData: initial,
    refetchInterval: (query) => {
      if (isConnected) return false;
      const anyRunning = (query.state.data ?? []).some((p) => p.currentStatus === "GENERATING");
      return anyRunning ? 4000 : false;
    },
  });

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("papers-library")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "paper_analyses",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["papers-library"] });
        },
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    return () => {
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { papers: data, isConnected };
}
