import { generateUUID } from '@/lib/utils';
import type { ModelId } from '@/lib/ai/model-id';
import type { StreamWriter } from '../types';
import type { ArtifactKind } from '@/lib/artifacts/artifact-kind';
import type { ArtifactToolResult } from './artifact-tool-result';
import type { DocumentHandler } from '@/lib/artifacts/server';


export async function createDocument({
  dataStream,
  kind,
  title,
  description,
  prompt,
  messageId,
  selectedModel,
  documentHandler,
}: {
  dataStream: StreamWriter;
  kind: ArtifactKind;
  title: string;
  description: string;
  prompt: string;
  messageId: string;
  selectedModel: ModelId;
  documentHandler: DocumentHandler<ArtifactKind>;
}): Promise<ArtifactToolResult> {
  const id = generateUUID();

  dataStream.write({
    type: 'data-kind',
    data: kind,
    transient: true,
  });

  dataStream.write({
    type: 'data-id',
    data: id,
    transient: true,
  });

  dataStream.write({
    type: 'data-messageId',
    data: messageId,
    transient: true,
  });

  dataStream.write({
    type: 'data-title',
    data: title,
    transient: true,
  });

  dataStream.write({
    type: 'data-clear',
    data: null,
    transient: true,
  });

  await documentHandler.onCreateDocument({
    id,
    title,
    description,
    dataStream,
    prompt,
    messageId,
    selectedModel,
  });

  dataStream.write({ type: 'data-finish', data: null, transient: true });

  const result: ArtifactToolResult = {
    id,
    title,
    kind,
    content: 'A document was created and is now visible to the user.',
  };

  return result;
}
