import type { OpenAIProvider} from '@ai-sdk/openai';

type OpenAIProviderModelId = Parameters<OpenAIProvider>[0]


// Exclude the non-literal model ids
type LiteralModelId = OpenAIProviderModelId extends infer T
  ? T extends string
    ? string extends T
      ? never
      : T
    : never
  : never;

// Adds models available in gateway but not yet in the gateway package
export type ModelId = LiteralModelId | 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano'
