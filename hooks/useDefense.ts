"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getDefenseData, type DefenseData } from "@/lib/defense/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Live defense questions + practice history.
 *
 * Server-rendered `initial` seeds first paint; Realtime keeps generation status
 * live so the questions appear the moment the job finishes, and new practice
 * sessions show up in the history without a refresh.
 */
export interface DefenseValue {
  data: DefenseData;
  isConnected: boolean;
}

export function useDefense(analysisId: string, userId: string, initial: DefenseData): DefenseValue {
  const [isConnected, setIsConnected] = React.useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["defense", analysisId],
    queryFn: async (): Promise<DefenseData> => (await getDefenseData(analysisId)) ?? initial,
    initialData: initial,
    refetchInterval: (query) =>
      !isConnected && query.state.data?.status === "GENERATING" ? 3000 : false,
  });

  React.useEffect(() => {
    const supabase = createClient();
    const invalidate = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["defense", analysisId] });
    };

    const channel = supabase
      .channel(`defense:${analysisId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "paper_analyses", filter: `id=eq.${analysisId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "defense_question_groups", filter: `paper_analysis_id=eq.${analysisId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "defense_practices", filter: `user_id=eq.${userId}` },
        invalidate,
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    return () => {
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [analysisId, userId, queryClient]);

  return { data, isConnected };
}
