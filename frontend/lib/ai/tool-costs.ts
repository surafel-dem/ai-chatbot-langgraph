import type { ChatModel } from './models';

// Fixed tool credit costs (simple and explicit)
export const TOOL_CREDIT_COSTS = {
  getWeather: 1,
  createDocument: 5,
  updateDocument: 5,
  requestSuggestions: 1,
} as const;

export type ToolName = keyof typeof TOOL_CREDIT_COSTS;

// Base model cost by model id (keep simple; can refine later)
export function getBaseModelCost(modelId: ChatModel['id']): number {
  switch (modelId) {
    case 'chat-model-reasoning':
      return 2;
    case 'chat-model':
    default:
      return 1;
  }
}

export function getMaxToolCost(): number {
  return Math.max(...Object.values(TOOL_CREDIT_COSTS));
}


