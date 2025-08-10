'use client';

import { useMemo } from 'react';
import { useDataStream } from '@/components/data-stream-provider';
import { featureFlags } from '@/lib/feature-flags';
import { Markdown } from '@/components/markdown';
import { useOrchestratorStore } from '@/stores/orchestrator-store';

export function AssistantStream() {
  const { dataStream } = useDataStream();

  const text = useMemo(() => {
    if (!featureFlags.agentsOrchestrator) return '';
    return dataStream
      .filter((p: any) => p.type === 'data-textDelta' && typeof (p as any).data === 'string')
      .map((p: any) => p.data as string)
      .join('');
  }, [dataStream]);

  const citations = useOrchestratorStore((s) => s.citations);

  if (!text) return null;

  return (
    <div className="mx-auto w-full md:max-w-3xl px-4 pb-2">
      <div className="prose dark:prose-invert max-w-none leading-6">
        <Markdown>{text}</Markdown>
      </div>
      {citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {citations.map((c) => (
            <a key={c.index} href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2 py-1 hover:bg-muted/50">
              <span className="inline-block rounded bg-indigo-600 text-white px-1.5 py-0.5 text-[10px]">{c.index}</span>
              <span className="line-clamp-1 max-w-[200px]">{c.title ?? c.url}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}


