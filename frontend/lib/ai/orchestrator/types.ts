export type ToolEvent =
  | { type: 'start'; name: string; input: unknown }
  | { type: 'result'; name: string; output: unknown };

export type Source = { url: string; title?: string; snippet?: string; meta?: any };

export interface SpecialistResult {
  textStream: AsyncIterable<string>;
  toolEvents: AsyncIterable<ToolEvent>;
  sources?: Source[];
}

export type NextStep =
  | 'plan'
  | 'purchase_advice'
  | 'running_cost'
  | 'reliability'
  | 'synthesis'
  | 'finalize';

export interface RunContext {
  ui: any; // UIMessageStreamWriter from 'ai'
  messages: any[]; // AI SDK message format
  chatId: string;
  runId: string;
  userId: string;
  signal: AbortSignal;
  convex: any;
  selectedChatModel?: string;
  intent?: 'plan' | 'analyze';
}


