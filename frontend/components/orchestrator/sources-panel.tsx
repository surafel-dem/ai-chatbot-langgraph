'use client';

import { useOrchestratorStore } from '@/stores/orchestrator-store';

export function SourcesPanel() {
  const sources = useOrchestratorStore((s) => s.sources);
  if (!sources.length) return null;
  return (
    <div className="mx-auto w-full md:max-w-3xl px-4 pb-2 text-xs text-muted-foreground">
      <div className="rounded-md border bg-muted/30 px-3 py-2">
        <div className="font-medium text-foreground/80">Sources</div>
        <ul className="mt-1 list-disc ml-4">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`}>
              <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                {s.title ?? s.url}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


