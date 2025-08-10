import { myProvider } from '@/lib/ai/providers';

export const getModel = (selected?: string) =>
  // Adapt if providers export differs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (myProvider as any).languageModel?.(selected) || (myProvider as any).chatModel?.(selected);

 