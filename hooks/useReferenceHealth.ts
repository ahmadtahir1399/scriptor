"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { JobStatus } from "@/lib/db/enums";
import type { ReferenceHealthSnapshot } from "@/lib/db/queries/references";
import { getReferenceHealthData } from "@/lib/references/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Live reference-health data.
 *
 * Realtime is the primary channel and polling is the backstop. The backstop
 * runs whenever verification is still in flight, WITHOUT consulting the socket.
 *
 * That is deliberate and was learned the hard way. `bibliography_references`,
 * `in_text_references` and `reference_pairs` are not members of the
 * `supabase_realtime` publication (16_storage_realtime.sql adds exactly three
 * tables, none of them these), so the channel below subscribes perfectly
 * happily and then delivers nothing at all. A `SUBSCRIBED` status is proof the
 * socket opened, never proof that rows will arrive — so gating the fallback on
 * it froze the page on "verifying" for the entire run, which is precisely the
 * spinner-with-no-state-behind-it this hook exists to prevent.
 *
 * Server-rendered `initial` seeds the first paint, so counts and the reference
 * list are present immediately and fill in as each source resolves.
 */

export interface ReferenceHealthValue {
  status: JobStatus;
  snapshot: ReferenceHealthSnapshot;
  isConnected: boolean;
}

export interface ReferenceHealthSeed {
  status: JobStatus;
  snapshot: ReferenceHealthSnapshot;
}

export function useReferenceHealth(
  analysisId: string,
  initial: ReferenceHealthSeed,
): ReferenceHealthValue {
  const [isConnected, setIsConnected] = React.useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["reference-health", analysisId],
    queryFn: async (): Promise<ReferenceHealthSeed> => {
      const next = await getReferenceHealthData(analysisId);
      return next ?? initial;
    },
    initialData: initial,
    // Poll while verification is in flight, connected or not — see above.
    refetchInterval: (query) =>
      query.state.data?.status === "GENERATING" ? 3000 : false,
  });

  React.useEffect(() => {
    const supabase = createClient();
    const filter = `paper_analysis_id=eq.${analysisId}`;
    const invalidate = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["reference-health", analysisId] });
    };

    const channel = supabase.channel(`reference-health:${analysisId}`);
    for (const table of ["bibliography_references", "in_text_references", "reference_pairs"] as const) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, invalidate);
    }

    // The analysis row carries reference_health_status — watch it too so DONE
    // flips the UI out of its "verifying" state without a manual refetch.
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "paper_analyses", filter: `id=eq.${analysisId}` },
      invalidate,
    );

    channel.subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    return () => {
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [analysisId, queryClient]);

  return { status: data.status, snapshot: data.snapshot, isConnected };
}
