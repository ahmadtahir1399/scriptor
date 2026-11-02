"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { getAnalysisWithResults } from "@/lib/db/queries/analyses";
import type { AnalysisWithResults } from "@/lib/domain/analysis";

/**
 * The report snapshot as TanStack Query state.
 *
 * The query goes through P1's `getAnalysisWithResults` with the BROWSER client,
 * so RLS applies and the read stays inside `lib/db/queries` — no inline
 * `.from()` here. `initialData` is the server-rendered snapshot, so first paint
 * already shows whatever was ready; the stream hook then keeps it live.
 */
export const analysisQueryKey = (analysisId: string) =>
  ["analysis", analysisId] as const;

export function useAnalysis(
  analysisId: string,
  initialData: AnalysisWithResults,
): UseQueryResult<AnalysisWithResults> {
  return useQuery({
    queryKey: analysisQueryKey(analysisId),
    queryFn: async (): Promise<AnalysisWithResults> => {
      const db = createClient();
      const data = await getAnalysisWithResults(db, analysisId);
      if (!data) {
        // The row vanished or access was revoked mid-session. Surface it rather
        // than caching a stale copy.
        throw new Error("Analysis not found.");
      }
      return data;
    },
    initialData,
    // The stream drives refetches; window focus should not.
    refetchOnWindowFocus: false,
    staleTime: 1000,
    /*
     * Poll while the run is still going, as a fallback behind Realtime.
     *
     * `paper_analyses` and `check_results` DO have user RLS policies, so the
     * socket genuinely works here — unlike the ingestion stages. But a socket
     * that fails to connect (restrictive network, proxy, sleeping laptop) would
     * otherwise leave the report frozen with no second channel, which is
     * exactly how the ingestion view used to break. Stops as soon as the
     * analysis is terminal, so a finished report costs nothing.
     */
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "DONE" || status === "ERROR" ? false : 3000;
    },
  });
}
