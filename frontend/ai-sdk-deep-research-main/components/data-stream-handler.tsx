'use client';
import { useEffect, useRef } from 'react';
import { artifactDefinitions } from './artifact';
import { initialArtifactData, useArtifact } from '@/components/use-artifact';
import { useDataStream } from '@/components/data-stream-provider';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'message-id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind';
  content: string ;
};

export function DataStreamHandler({ id }: { id: string }) {
  const { dataStream } = useDataStream();
  const { artifact, setArtifact } = useArtifact();
  const lastProcessedIndex = useRef(-1);


  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    newDeltas.forEach((delta) => {
      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
        });
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

          case 'data-messageId':
            return {
              ...draftArtifact,
              messageId: delta.data,
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
  }, [
    dataStream,
    setArtifact,
    artifact,
  ]);

  return null;
}
