import type { ModelId } from '@/lib/ai/model-id';
import type { StreamWriter } from '@/lib/ai/types';
import type { ArtifactKind } from '@/lib/artifacts/artifact-kind';

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  dataStream: StreamWriter;
  description: string;
  prompt: string;
  messageId: string;
  selectedModel: ModelId;
}

export interface UpdateDocumentCallbackProps {
  document: Document;
  description: string;
  dataStream: StreamWriter;
  messageId: string;
  selectedModel: ModelId;
}

export interface DocumentHandler<T = ArtifactKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument(args);

    

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument(args);

      return;
    },
  };
}
