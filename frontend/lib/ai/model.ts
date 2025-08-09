// Thin shim to obtain a model from our provider using a consistent API
import { myProvider } from '@/lib/ai/providers';

export function getModel(selectedModelId?: string) {
  const provider: any = myProvider as any;
  if (typeof provider?.languageModel === 'function') {
    return provider.languageModel(selectedModelId);
  }
  if (typeof provider?.chatModel === 'function') {
    return provider.chatModel(selectedModelId);
  }
  throw new Error('No compatible model factory found on provider');
}


