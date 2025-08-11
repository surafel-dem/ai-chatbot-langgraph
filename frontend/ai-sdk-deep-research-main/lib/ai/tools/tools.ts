import type { ModelMessage } from 'ai';
import type { StreamWriter } from '../types';
import { deepResearch } from './deep-research/deep-research';

export function getTools({
  dataStream,
  messageId,
  contextForLLM,
}: {
  dataStream: StreamWriter;
  messageId: string;
  contextForLLM: ModelMessage[];
}) {
  return {
    deepResearch: deepResearch({
      dataStream,
      messageId,
      messages: contextForLLM,
    }),
  };
}
