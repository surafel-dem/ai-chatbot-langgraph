import { z } from 'zod';
import type { getWeather } from '@/lib/ai/tools/get-weather';
import type { updateDocument } from '@/lib/ai/tools/update-document';
import type { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import type { deepResearch } from '@/lib/ai/tools/deep-research/deep-research';
import type { readDocument } from '@/lib/ai/tools/read-document';
import type { generateImage } from '@/lib/ai/tools/generate-image';
import type { tavilyWebSearch } from '@/lib/ai/tools/web-search';
import type { stockChart } from '@/lib/ai/tools/stock-chart';
import type { codeInterpreter } from '@/lib/ai/tools/code-interpreter';
import type { retrieve } from '@/lib/ai/tools/retrieve';
import type { InferUITool, UIMessage, UIMessageStreamWriter } from 'ai';

import type { ArtifactKind } from '../artifacts/artifact-kind';
import type { Suggestion } from '@/lib/db/schema';
import type { ResearchUpdate } from './tools/research-updates-schema';
import type { createDocumentTool as createDocument } from './tools/create-document';

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

const _ = toolNameSchema.options satisfies ToolName[];

type ToolNameInternal = z.infer<typeof toolNameSchema>;

export const frontendToolsSchema = z.enum([
  'webSearch',
  'deepResearch',
  'generateImage',
  'createDocument',
]);

const __ = frontendToolsSchema.options satisfies ToolNameInternal[];

export type UiToolName = z.infer<typeof frontendToolsSchema>;
export const messageMetadataSchema = z.object({
  createdAt: z.date(),
  parentMessageId: z.string().nullable(),
  selectedModel: z.string(),
  isPartial: z.boolean().optional(),
  selectedTool: frontendToolsSchema.optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type deepResearchTool = InferUITool<ReturnType<typeof deepResearch>>;
type readDocumentTool = InferUITool<ReturnType<typeof readDocument>>;
type generateImageTool = InferUITool<ReturnType<typeof generateImage>>;
type webSearchTool = InferUITool<ReturnType<typeof tavilyWebSearch>>;
type stockChartTool = InferUITool<typeof stockChart>;
type codeInterpreterTool = InferUITool<typeof codeInterpreter>;
type retrieveTool = InferUITool<typeof retrieve>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  deepResearch: deepResearchTool;
  readDocument: readDocumentTool;
  generateImage: generateImageTool;
  webSearch: webSearchTool;
  stockChart: stockChartTool;
  codeInterpreter: codeInterpreterTool;
  retrieve: retrieveTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  messageId: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  researchUpdate: ResearchUpdate;
};

export type ChatMessage = Omit<
  UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>,
  'metadata'
> & {
  metadata: MessageMetadata;
};

export type ToolName = keyof ChatTools;

export type StreamWriter = UIMessageStreamWriter<ChatMessage>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}
