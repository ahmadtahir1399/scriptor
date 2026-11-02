"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getTodoData, toggleTodo, type TodoData } from "@/lib/todos/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Live to-do plan with optimistic check-off.
 *
 * Server-rendered `initial` seeds first paint; Realtime keeps the plan live so
 * it appears the moment generation finishes. Check-off is OPTIMISTIC — the query
 * cache flips instantly and rolls back on failure — so ticking through tasks
 * never feels latency.
 */
export interface TodosValue {
  data: TodoData;
  isConnected: boolean;
  toggle: (itemId: string, done: boolean) => void;
}

function optimisticToggle(data: TodoData, itemId: string, done: boolean): TodoData {
  return {
    ...data,
    plan: data.plan.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.id === itemId
          ? { ...item, is_done: done, completed_at: done ? new Date().toISOString() : null }
          : item,
      ),
    })),
  };
}

export function useTodos(analysisId: string, userId: string, initial: TodoData): TodosValue {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = React.useState(false);
  const queryKey = React.useMemo(() => ["todos", analysisId] as const, [analysisId]);

  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<TodoData> => (await getTodoData(analysisId)) ?? initial,
    initialData: initial,
    refetchInterval: (query) =>
      !isConnected && query.state.data?.status === "GENERATING" ? 3000 : false,
  });

  React.useEffect(() => {
    const supabase = createClient();
    const invalidate = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["todos", analysisId] });
    };

    const channel = supabase
      .channel(`todos:${analysisId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "paper_analyses", filter: `id=eq.${analysisId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todo_groups", filter: `paper_analysis_id=eq.${analysisId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todo_items", filter: `user_id=eq.${userId}` },
        invalidate,
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    return () => {
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [analysisId, userId, queryClient]);

  const toggle = React.useCallback(
    (itemId: string, done: boolean) => {
      queryClient.setQueryData<TodoData>(queryKey, (prev) =>
        prev ? optimisticToggle(prev, itemId, done) : prev,
      );
      void (async () => {
        const result = await toggleTodo({ itemId, done });
        if (!result.ok) void queryClient.invalidateQueries({ queryKey });
      })();
    },
    [queryClient, queryKey],
  );

  return { data, isConnected, toggle };
}
