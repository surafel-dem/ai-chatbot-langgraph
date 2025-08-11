import type { UseChatHelpers } from '@ai-sdk/react';
import type { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react';
import type { UIArtifact } from '@/components/artifact';
import type { ChatMessage, CustomUIDataTypes } from '@/lib/ai/types';
import type { DataUIPart } from 'ai';



interface ArtifactContent<M = any> {
  content: string;
}

type ArtifactConfig<T extends string, M = any> = {
  kind: T;
  description: string;
  content: ComponentType<ArtifactContent<M>>;
  onStreamPart: (args: {
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: DataUIPart<CustomUIDataTypes>;
  }) => void;
};

export class Artifact<T extends string, M = any> {
  readonly kind: T;
  readonly description: string;
  readonly content: ComponentType<ArtifactContent<M>>;
  readonly onStreamPart: (args: {
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: DataUIPart<CustomUIDataTypes>;
  }) => void;

  constructor(config: ArtifactConfig<T, M>) {
    this.kind = config.kind;
    this.description = config.description;
    this.content = config.content;
    this.onStreamPart = config.onStreamPart;
  }
}
