'use client';

import { useState } from 'react';
import { featureFlags } from '@/lib/feature-flags';

export function PlannerHint() {
  const [hidden, setHidden] = useState(false);
  if (!featureFlags.agentsOrchestrator || hidden) return null;
  return (
    <div className="mx-auto w-full md:max-w-3xl px-4 pb-2 text-xs text-muted-foreground">
      <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-start justify-between gap-4">
        <div>
          Tip: Start with a make/model/year, e.g., “2018 Toyota Corolla”. The planner will normalize details and guide you to a specialist.
        </div>
        <button onClick={() => setHidden(true)} className="text-foreground/60 hover:text-foreground">✕</button>
      </div>
    </div>
  );
}


