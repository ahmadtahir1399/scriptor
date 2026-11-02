import { create } from "zustand";

import type { SeverityFilterValue } from "@/lib/validations/finding";

/**
 * Page-local viewer state.
 *
 * ONE store, read by both the canvas and the sidebar, so the two panes stay in
 * sync without prop-drilling between them (per the sync model in the prompt).
 * It is deliberately not persisted — zoom and focus are per-visit, and a
 * remembered scroll position on a re-opened document would be more confusing
 * than helpful.
 */

export type ZoomMode = "fit" | "actual" | "wide";

export interface ViewerState {
  /** Clicked or deep-linked finding — scrolled to, pulsed, "focused". */
  focusedFindingId: string | null;
  setFocusedFinding: (id: string | null) => void;

  /** Hovered finding — its highlight brightens (either pane may set it). */
  hoveredFindingId: string | null;
  setHoveredFinding: (id: string | null) => void;

  /** Most-visible page, driven by scroll-spy. */
  currentPage: number;
  setCurrentPage: (page: number) => void;

  zoomMode: ZoomMode;
  /** Explicit multiplier when zoomMode is "actual"/"wide" derived, else fit. */
  zoom: number;
  setZoomMode: (mode: ZoomMode) => void;
  setZoom: (zoom: number) => void;

  severityFilter: SeverityFilterValue;
  setSeverityFilter: (value: SeverityFilterValue) => void;

  showResolved: boolean;
  toggleShowResolved: () => void;

  /**
   * Optimistic resolved overrides, keyed by finding id. The UI reads this over
   * the server value so a resolve reflects instantly; it is cleared once the
   * server write confirms (or rolled back on failure).
   */
  resolvedOptimistic: Record<string, boolean>;
  setOptimisticResolved: (id: string, resolved: boolean) => void;
  clearOptimisticResolved: (id: string) => void;

  thumbnailsCollapsed: boolean;
  toggleThumbnails: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useViewerStore = create<ViewerState>()((set) => ({
  focusedFindingId: null,
  setFocusedFinding: (id) => set({ focusedFindingId: id }),

  hoveredFindingId: null,
  setHoveredFinding: (id) => set({ hoveredFindingId: id }),

  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),

  zoomMode: "fit",
  zoom: 1,
  setZoomMode: (mode) => set({ zoomMode: mode }),
  setZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.5, zoom)) }),

  severityFilter: "ALL",
  setSeverityFilter: (value) => set({ severityFilter: value }),

  showResolved: false,
  toggleShowResolved: () => set((state) => ({ showResolved: !state.showResolved })),

  resolvedOptimistic: {},
  setOptimisticResolved: (id, resolved) =>
    set((state) => ({ resolvedOptimistic: { ...state.resolvedOptimistic, [id]: resolved } })),
  clearOptimisticResolved: (id) =>
    set((state) => {
      const next = { ...state.resolvedOptimistic };
      delete next[id];
      return { resolvedOptimistic: next };
    }),

  thumbnailsCollapsed: false,
  toggleThumbnails: () => set((state) => ({ thumbnailsCollapsed: !state.thumbnailsCollapsed })),

  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
