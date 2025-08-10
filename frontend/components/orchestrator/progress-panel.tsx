'use client';

import { useOrchestratorStore } from '@/stores/orchestrator-store';

export function ProgressPanel() {
  const finishedSteps = useOrchestratorStore((s) => s.finishedSteps);
  const statuses = useOrchestratorStore((s) => s.statuses);
  if (!finishedSteps) return null;
  return (
    <div className="mx-auto w-full md:max-w-3xl px-4 pb-4 text-xs text-muted-foreground">
      <div className="rounded-md border bg-muted/30 px-3 py-2">
        <div className="font-medium text-foreground/80 flex items-center gap-2">
          <span>Progress</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/70">{finishedSteps} steps</span>
        </div>
        {featureFlags.agentDebugStatus && statuses.length > 0 && (
          <ul className="mt-2 space-y-1">
            {statuses.slice(-8).map((s, i) => (
              <li key={i} className="leading-5">
                {s.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


