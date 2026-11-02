"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getPaperDetail } from "@/lib/papers/actions";
import type { PaperDetailView } from "@/lib/papers/presentation";
import { createClient } from "@/lib/supabase/client";

/**
 * Live paper detail.
 *
 * Seeds from the server-rendered `initial` view-model, then keeps the version
 * list live: a re-analysed version streams from GENERATING to its new score via
 * Realtime on `paper_analyses` filtered to this paper, with no manual refresh.
 */
export interface PaperDetailValue {
  detail: PaperDetailView;
  isConnected: boolean;
}

export function usePaperDetail(paperId: string, initial: PaperDetailView): PaperDetailValue {
  const [isConnected, setIsConnected] = React.useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["paper-detail", paperId],
    queryFn: async (): Promise<PaperDetailView> => {
      const next = await getPaperDetail(paperId);
      return next ?? initial;
    },
    initialData: initial,
    refetchInterval: (query) => {
      if (isConnected) return false;
      const anyRunning = (query.state.data?.versions ?? []).some((v) => v.status === "GENERATING");
      return anyRunning ? 4000 : false;
    },
  });

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`paper-detail:${paperId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "paper_analyses",
          filter: `paper_id=eq.${paperId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["paper-detail", paperId] });
        },
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    return () => {
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [paperId, queryClient]);

  return { detail: data, isConnected };
}
