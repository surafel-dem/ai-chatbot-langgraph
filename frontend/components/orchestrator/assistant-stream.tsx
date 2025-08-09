'use client';

import { useMemo } from 'react';
import { useDataStream } from '@/components/data-stream-provider';
import { featureFlags } from '@/lib/feature-flags';

export function AssistantStream() {
  const { dataStream } = useDataStream();

  const text = useMemo(() => {
    if (!featureFlags.agentsOrchestrator) return '';
    return dataStream
      .filter((p: any) => p.type === 'data-textDelta' && typeof (p as any).data === 'string')
      .map((p: any) => p.data as string)
      .join('');
  }, [dataStream]);

  if (!text) return null;

  return (
    <div className="mx-auto w-full md:max-w-3xl px-4 pb-6">
      <div className="rounded-lg bg-muted/30 border px-4 py-3 whitespace-pre-wrap leading-6">
        {text}
      </div>
    </div>
  );
}


