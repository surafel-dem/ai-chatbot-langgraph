import type { ImageModelId, ModelId } from '@/lib/ai/model-id';

export interface ModelFeatures {
  reasoning: boolean;
  functionCalling: boolean;
  knowledgeCutoff?: Date;
  input: {
    image: boolean;
    text: boolean;
    pdf: boolean;
    audio: boolean;
  };
  output: {
    image: boolean;
    text: boolean;
    audio: boolean;
  };
  fixedTemperature?: number;
}

export const modelFeatures: Partial<Record<ModelId, ModelFeatures>> = {
  'anthropic/claude-3-opus': {
    reasoning: false,
    functionCalling: true,
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'anthropic/claude-3.5-sonnet': {
    reasoning: false,
    functionCalling: true,
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'anthropic/claude-3.5-haiku': {
    reasoning: false,
    functionCalling: true,
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'anthropic/claude-3.7-sonnet': {
    reasoning: true,
    functionCalling: true,
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'anthropic/claude-4-opus': {
    reasoning: true,
    functionCalling: true,
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'anthropic/claude-4-sonnet': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2025-03-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'anthropic/claude-4.1-opus': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-04-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'google/gemini-2.5-flash': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2025-01-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: true,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'google/gemini-2.5-pro': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2025-01-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: true,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'google/gemini-2.0-flash': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-08-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: true,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'google/gemini-2.0-flash-lite': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-08-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: true,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },

  'openai/o3-mini': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2023-10-01'),
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/o3': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2025-03-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/o4-mini': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-05-31'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
    fixedTemperature: 1,
  },
  'openai/gpt-4.1': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-06-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-4.1-mini': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-06-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-4.1-nano': {
    reasoning: false,
    functionCalling: true,
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-4o': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2023-10-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-4o-mini': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2023-10-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },

  'openai/gpt-5': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-10-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-5-mini': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-05-31'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-5-nano': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-05-31'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-4-turbo': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2023-12-01'),
    input: {
      image: true,
      text: true,
      pdf: true,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-3.5-turbo': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2021-09-01'),
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-3.5-turbo-instruct': {
    reasoning: false,
    functionCalling: false,
    knowledgeCutoff: new Date('2021-09-01'),
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-oss-120b': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-04-01'),
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'openai/gpt-oss-20b': {
    reasoning: false,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-04-01'),
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'xai/grok-2': {
    reasoning: false,
    functionCalling: true,
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'xai/grok-2-vision': {
    reasoning: false,
    functionCalling: true,
    input: {
      image: true,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'xai/grok-3': {
    reasoning: true,
    functionCalling: true,
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'xai/grok-3-fast': {
    reasoning: true,
    functionCalling: true,
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'xai/grok-3-mini': {
    reasoning: true,
    functionCalling: true,
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'xai/grok-3-mini-fast': {
    reasoning: true,
    functionCalling: true,
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'zai/glm-4.5': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-04-01'),
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
  'zai/glm-4.5-air': {
    reasoning: true,
    functionCalling: true,
    knowledgeCutoff: new Date('2024-04-01'),
    input: {
      image: false,
      text: true,
      pdf: false,
      audio: false,
    },
    output: {
      image: false,
      text: true,
      audio: false,
    },
  },
};

export const imageModelsFeatures: Partial<Record<ImageModelId, ModelFeatures>> =
  {
    'openai/gpt-image-1': {
      reasoning: false,
      functionCalling: false,
      knowledgeCutoff: new Date('2025-04-01'),
      input: {
        image: true,
        text: true,
        pdf: false,
        audio: false,
      },
      output: {
        image: true,
        text: false,
        audio: false,
      },
    },
  };
