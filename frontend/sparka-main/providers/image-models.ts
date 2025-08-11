import type { ImageModelId } from '@/lib/ai/model-id';
import type { ProviderId } from './models-generated';

export interface ImageModelData {
  id: ImageModelId;
  object: string;
  owned_by: ProviderId;
  name: string;
  description: string;
  context_window: number; // Max input tokens
  max_tokens: number; // Max output tokens
  pricing: {
    input: string; // Input price per token
    output: string; // Output price per token
  };
}

// Define the data with proper typing
export const imageModelsData: ImageModelData[] = [
  {
    id: 'openai/gpt-image-1',
    object: 'model',
    owned_by: 'openai',
    name: 'GPT-Image-1',
    description:
      'Advanced image generation model with superior accuracy and diverse visual styles',
    context_window: 1024,
    max_tokens: 1024,
    pricing: {
      input: '0.000005', // Text input: $5.00 / 1M tokens, Image input: $10.00 / 1M tokens
      output: '0.0004', // Output image tokens: $40.00 / 1M tokens
    },
  },
];
