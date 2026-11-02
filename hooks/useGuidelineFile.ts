"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getGuidelineFileData } from "@/lib/requirements/actions";
import type { RequirementFileWithRequirements } from "@/lib/domain/requirement";
import { createClient } from "@/lib/supabase/client";

/**
 * Live guideline-file detail.
 *
 * Seeds from the server-rendered file, then streams extraction progress: the
 * status flips and the extracted requirements appear as the inline job writes
 * them, via Realtime on `requirement_files` and `requirements` scoped to this
 * file. Never a bare spinner.
 */
export interface GuidelineFileValue {
  file: RequirementFileWithRequirements;
  isConnected: boolean;
}

export function useGuidelineFile(
  fileId: string,
  initial: RequirementFileWithRequirements,
): GuidelineFileValue {
  const [isConnected, setIsConnected] = React.useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["guideline-file", fileId],
    queryFn: async (): Promise<RequirementFileWithRequirements> => {
      const next = await getGuidelineFileData(fileId);
      return next ?? initial;
    },
    initialData: initial,
    refetchInterval: (query) =>
      !isConnected && query.state.data?.extraction_status === "GENERATING" ? 2500 : false,
  });

  React.useEffect(() => {
    const supabase = createClient();
    const invalidate = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["guideline-file", fileId] });
    };

    const channel = supabase
      .channel(`guideline-file:${fileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requirement_files", filter: `id=eq.${fileId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requirements",
          filter: `requirement_file_id=eq.${fileId}`,
        },
        invalidate,
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    return () => {
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [fileId, queryClient]);

  return { file: data, isConnected };
}
