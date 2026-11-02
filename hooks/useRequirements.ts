"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getRequirementsLibrary, type RequirementsLibrary } from "@/lib/requirements/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Live requirements library.
 *
 * Server-rendered `initial` seeds first paint; Realtime on `requirement_files`
 * keeps extraction status live, so a guideline card streams from "processing"
 * to "done" and its new requirements appear without a refresh.
 */
export interface RequirementsLibraryValue {
  library: RequirementsLibrary;
  isConnected: boolean;
}

export function useRequirements(
  initial: RequirementsLibrary,
  userId: string,
): RequirementsLibraryValue {
  const [isConnected, setIsConnected] = React.useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["requirements-library"],
    queryFn: () => getRequirementsLibrary(),
    initialData: initial,
    refetchInterval: (query) => {
      if (isConnected) return false;
      const processing = (query.state.data?.files ?? []).some(
        (file) => file.extraction_status === "GENERATING",
      );
      return processing ? 3000 : false;
    },
  });

  React.useEffect(() => {
    const supabase = createClient();
    const invalidate = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["requirements-library"] });
    };

    const channel = supabase.channel("requirements-library");
    for (const table of ["requirement_files", "requirements"] as const) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        invalidate,
      );
    }
    channel.subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    return () => {
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { library: data, isConnected };
}
