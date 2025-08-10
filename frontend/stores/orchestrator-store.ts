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
  citations: Array<{ index: number; url: string; title?: string; snippet?: string }>;
  activities: Array<{ ts: number; type: 'tool' | 'status'; label: string }>; 
  setPlannerState: (p: PlannerState) => void;
  addSource: (s: SourceItem) => void;
  addSources: (s: SourceItem[]) => void;
  markStepFinished: () => void;
  addStatus: (s: { text: string; level?: 'info' | 'warn' | 'error' }) => void;
  addCitation: (c: { index: number; url: string; title?: string; snippet?: string }) => void;
  resetCitations: () => void;
  addActivity: (e: { type: 'tool' | 'status'; label: string }) => void;
  reset: () => void;
};

export const useOrchestratorStore = create<OrchestratorState>((set) => ({
  plannerState: null,
  sources: [],
  finishedSteps: 0,
  statuses: [],
  citations: [],
  activities: [],
  setPlannerState: (p) => set({ plannerState: p }),
  addSource: (s) => set((st) => ({ sources: [...st.sources, s] })),
  addSources: (arr) => set((st) => ({ sources: [...st.sources, ...arr] })),
  markStepFinished: () => set((st) => ({ finishedSteps: st.finishedSteps + 1 })),
  addStatus: (s) => set((st) => ({ statuses: [...st.statuses, s] })),
  addCitation: (c) => set((st) => ({ citations: [...st.citations, { ...c, index: c.index ?? st.citations.length + 1 }] })),
  resetCitations: () => set({ citations: [] }),
  addActivity: (e) => set((st) => ({ activities: [{ ts: Date.now(), ...e }, ...st.activities].slice(0, 50) })),
  reset: () => set({ plannerState: null, sources: [], finishedSteps: 0, citations: [], statuses: [], activities: [] }),
}));


