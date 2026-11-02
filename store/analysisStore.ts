import { create } from "zustand";

import type { JobStatus } from "@/lib/constants";

/**
 * Client-side analysis state.
 *
 * Typed skeleton — the shape is final, the logic is not. P4 populates this
 * with real progress streaming. Anything added later must extend this
 * interface rather than replace it, because the shell already subscribes to
 * `checkProgress` for the topbar job indicator.
 */
export interface AnalysisState {
  /** The analysis currently open in the workspace, if any. */
  activeAnalysisId: string | null;
  setActiveAnalysisId: (id: string | null) => void;

  /** Per-check job status, keyed by check id. */
  checkProgress: Record<string, JobStatus>;
  setCheckProgress: (checkId: string, status: JobStatus) => void;
  resetCheckProgress: () => void;
}

export const useAnalysisStore = create<AnalysisState>()((set) => ({
  activeAnalysisId: null,
  setActiveAnalysisId: (id) => set({ activeAnalysisId: id }),

  checkProgress: {},
  setCheckProgress: (checkId, status) =>
    set((state) => ({
      checkProgress: { ...state.checkProgress, [checkId]: status },
    })),
  resetCheckProgress: () => set({ checkProgress: {} }),
}));
