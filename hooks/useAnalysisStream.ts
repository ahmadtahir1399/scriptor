"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { analysisQueryKey } from "@/hooks/useAnalysis";

/**
 * Live report updates.
 *
 * Subscribes to the three Realtime channels P4 populates — `paper_analyses`,
 * `check_results`, `analysis_jobs` — all filtered to this analysis id. On any
 * change it refetches the report snapshot, which reconciles the socket event
 * into the Query cache (rather than hand-patching a deeply-nested structure).
 *
 * If the socket never connects — restrictive networks do block it — a 3-second
 * poll takes over. There is never a bare spinner once data exists: the page
 * already rendered the server snapshot, and this only ever refreshes it.
 *
 * The filter is defence in depth: RLS already stops another user's rows
 * reaching this client, and the `analysis_id` filter keeps this subscription
 * from waking on unrelated traffic.
 */

const POLL_INTERVAL_MS = 3000;
const REFETCH_DEBOUNCE_MS = 250;

export interface StreamState {
  isConnected: boolean;
}

export function useAnalysisStream(
  analysisId: string,
  /** Stop polling/subscribing once the analysis is terminal. */
  isTerminal: boolean,
): StreamState {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = React.useState(false);

  // Coalesce bursts of events (nine checks finishing near-simultaneously) into
  // one refetch.
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetch = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: analysisQueryKey(analysisId) });
    }, REFETCH_DEBOUNCE_MS);
  }, [queryClient, analysisId]);

  React.useEffect(() => {
    if (isTerminal) {
      setIsConnected(false);
      return;
    }

    const supabase = createClient();

    const channel = supabase
      .channel(`analysis:${analysisId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "paper_analyses", filter: `id=eq.${analysisId}` },
        refetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "check_results",
          filter: `paper_analysis_id=eq.${analysisId}`,
        },
        refetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "analysis_jobs",
          filter: `paper_analysis_id=eq.${analysisId}`,
        },
        refetch,
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [analysisId, isTerminal, refetch]);

  // Poll fallback — only while the socket is down and work is still running.
  React.useEffect(() => {
    if (isTerminal || isConnected) return;

    const timer = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: analysisQueryKey(analysisId) });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isTerminal, isConnected, queryClient, analysisId]);

  return { isConnected };
}
