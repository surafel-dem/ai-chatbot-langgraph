import { InferUITool, UIDataTypes, UIMessage, UIMessageStreamWriter } from 'ai';
import { z } from 'zod/v4';
import type { ResearchUpdate } from '@/lib/ai/tools/research-updates-schema';
import { ArtifactKind } from '@/lib/artifacts/artifact-kind';
import { deepResearch } from '@/lib/ai/tools/deep-research/deep-research';


export const toolNameSchema = z.enum([
  'getWeather',
  'createDocument',
  'updateDocument',
  'requestSuggestions',
  'readDocument',
  'retrieve',
  'webSearch',
  'stockChart',
  'codeInterpreter',
  'generateImage',
  'deepResearch',
]);





export const myMessageMetadataSchema = z.object({
  createdAt: z.number(),
});

export type MyMessageMetadata = z.infer<typeof myMessageMetadataSchema>;
type deepResearchTool = InferUITool<ReturnType<typeof deepResearch>>;

export type ChatTools = {
  deepResearch: deepResearchTool;
};

export type ToolName = keyof ChatTools;


export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  appendMessage: string;
  id: string;
  messageId: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  researchUpdate: ResearchUpdate;
};

export type StreamWriter = UIMessageStreamWriter<ChatMessage>;


export type ChatMessage = UIMessage<MyMessageMetadata, CustomUIDataTypes, ChatTools>;

export type ChatData = {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  activeStreamId: string | null;
};


export type DeepResearchReportOutput = Extract<deepResearchTool['output'], { format: 'report' }>