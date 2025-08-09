'use client';

import { useOrchestratorStore } from '@/stores/orchestrator-store';

export function PlannerPanel() {
  const plannerState = useOrchestratorStore((s) => s.plannerState);
  if (!plannerState) return null;
  const { make, model, year, body, trim, engine } = plannerState;

  return (
    <div className="mx-auto w-full md:max-w-3xl px-4 pb-2 text-xs text-muted-foreground">
      <div className="rounded-md border bg-muted/30 px-3 py-2">
        <div className="font-medium text-foreground/80">Planner</div>
        <div className="mt-1">
          Target: {make ?? ''} {model ?? ''} {year ?? ''}
          {body ? ` · ${body}` : ''}
          {trim ? ` · ${trim}` : ''}
          {engine ? ` · ${engine}` : ''}
        </div>
      </div>
    </div>
  );
}


