import { create } from 'zustand';

export type PlannerState = {
  make?: string;
  model?: string;
  year?: number;
  body?: string;
  trim?: string;
  engine?: string;
};

export type SourceItem = { url: string; title?: string };

type OrchestratorState = {
  plannerState: PlannerState | null;
  sources: SourceItem[];
  finishedSteps: number;
  statuses: { text: string; level?: 'info' | 'warn' | 'error' }[];
  setPlannerState: (p: PlannerState) => void;
  addSource: (s: SourceItem) => void;
  addSources: (s: SourceItem[]) => void;
  markStepFinished: () => void;
  addStatus: (s: { text: string; level?: 'info' | 'warn' | 'error' }) => void;
  reset: () => void;
};

export const useOrchestratorStore = create<OrchestratorState>((set) => ({
  plannerState: null,
  sources: [],
  finishedSteps: 0,
  statuses: [],
  setPlannerState: (p) => set({ plannerState: p }),
  addSource: (s) => set((st) => ({ sources: [...st.sources, s] })),
  addSources: (arr) => set((st) => ({ sources: [...st.sources, ...arr] })),
  markStepFinished: () => set((st) => ({ finishedSteps: st.finishedSteps + 1 })),
  addStatus: (s) => set((st) => ({ statuses: [...st.statuses, s] })),
  reset: () => set({ plannerState: null, sources: [], finishedSteps: 0 }),
}));


