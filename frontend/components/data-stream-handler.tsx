'use client';

import { useEffect, useRef } from 'react';
import { artifactDefinitions } from './artifact';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { useDataStream } from './data-stream-provider';
import { useOrchestratorStore } from '@/stores/orchestrator-store';
import { featureFlags } from '@/lib/feature-flags';

export function DataStreamHandler() {
  const { dataStream } = useDataStream();

  const { artifact, setArtifact, setMetadata } = useArtifact();
  const lastProcessedIndex = useRef(-1);
  const setPlanner = useOrchestratorStore((s) => s.setPlannerState);
  const addSource = useOrchestratorStore((s) => s.addSource);
  const markStepFinished = useOrchestratorStore((s) => s.markStepFinished);
  const addStatus = useOrchestratorStore((s) => s.addStatus);

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    newDeltas.forEach((delta) => {
      // Handle orchestrator-specific parts without disrupting existing artifact logic
      if (delta.type === 'data-textDelta') {
        // AssistantStream listens to these; nothing else to do here
      }
      if (delta.type === 'data-part' && typeof delta.data === 'object' && delta.data) {
        const kind = (delta.data as any).type;
        if (kind === 'planner-state') {
          setPlanner((delta.data as any).selectedCar ?? (delta.data as any));
        }
        if (kind === 'source-url') {
          addSource({ url: (delta.data as any).url, title: (delta.data as any).title });
        }
        if (kind === 'finish-step') {
          markStepFinished();
        }
        if (kind === 'status') {
          addStatus({ text: (delta.data as any).text, level: (delta.data as any).level });
        }
      }
      // Suppress artifact-driven modal opening during orchestrator mode
      if (!featureFlags.agentsOrchestrator) {
        const artifactDefinition = artifactDefinitions.find(
          (artifactDefinition) => artifactDefinition.kind === artifact.kind,
        );
        if (artifactDefinition?.onStreamPart) {
          artifactDefinition.onStreamPart({
            streamPart: delta,
            setArtifact,
            setMetadata,
          });
        }
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: 'streaming' };
        }

        switch (delta.type) {
          case 'data-id':
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: 'streaming',
            };

          case 'data-title':
            return {
              ...draftArtifact,
              title: delta.data,
              status: 'streaming',
            };

          case 'data-kind':
            return {
              ...draftArtifact,
              kind: delta.data,
              status: 'streaming',
            };

          case 'data-clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'data-finish':
            return {
              ...draftArtifact,
              status: 'idle',
            };

          default:
            return draftArtifact;
        }
      });
    });
  }, [dataStream, setArtifact, setMetadata, artifact]);

  return null;
}
