'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { ModelId } from '@/lib/ai/model-id';
import { toast } from 'sonner';

interface DefaultModelContextType {
  defaultModel: ModelId;
  changeModel: (modelId: ModelId) => Promise<void>;
}

const DefaultModelContext = createContext<DefaultModelContextType | undefined>(
  undefined,
);

interface DefaultModelClientProviderProps {
  children: ReactNode;
  defaultModel: ModelId;
}

export function DefaultModelProvider({
  children,
  defaultModel: initialModel,
}: DefaultModelClientProviderProps) {
  const [currentModel, setCurrentModel] = useState<ModelId>(initialModel);

  const changeModel = useCallback(
    async (modelId: ModelId) => {
      // Update local state immediately
      setCurrentModel(modelId);

      try {
        // Update cookies for persistence
        await fetch('/api/chat-model', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: modelId }),
        });
      } catch (error) {
        console.error('Failed to save chat model:', error);
        toast.error('Failed to save model preference');
        // Revert on error
        setCurrentModel(initialModel);
      }
    },
    [initialModel],
  );

  const value = useMemo(
    () => ({
      defaultModel: currentModel,
      changeModel,
    }),
    [currentModel, changeModel],
  );

  return (
    <DefaultModelContext.Provider value={value}>
      {children}
    </DefaultModelContext.Provider>
  );
}

export function useDefaultModel() {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      'useDefaultModel must be used within a DefaultModelProvider',
    );
  }
  return context.defaultModel;
}

export function useModelChange() {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      'useModelChange must be used within a DefaultModelProvider',
    );
  }
  return context.changeModel;
}
