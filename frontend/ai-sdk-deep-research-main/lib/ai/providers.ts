import { LanguageModel } from 'ai';
import type { ModelId } from './model-id';
    import { openai } from '@ai-sdk/openai';


export function getLanguageModel(modelId: ModelId): LanguageModel {
    return openai(modelId)
}