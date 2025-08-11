'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { UIArtifact } from '@/components/artifact';
import type { ReactNode } from 'react';

export const initialArtifactData: UIArtifact = {
  documentId: 'init',
  content: '',
  kind: 'text',
  title: '',
  messageId: '',
  status: 'idle',
  isVisible: false,
};

type Selector<T> = (state: UIArtifact) => T;

interface ArtifactContextType {
  artifact: UIArtifact;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact),
  ) => void;
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(
  undefined,
);

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [artifact, setArtifactState] =
    useState<UIArtifact>(initialArtifactData);

  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setArtifactState((currentArtifact) => {
        if (typeof updaterFn === 'function') {
          return updaterFn(currentArtifact);
        }
        return updaterFn;
      });
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      artifact,
      setArtifact,
    }),
    [artifact, setArtifact],
  );

  return (
    <ArtifactContext.Provider value={contextValue}>
      {children}
    </ArtifactContext.Provider>
  );
}

function useArtifactContext() {
  const context = useContext(ArtifactContext);
  if (!context) {
    throw new Error('Artifact hooks must be used within ArtifactProvider');
  }
  return context;
}

export function useArtifactSelector<Selected>(selector: Selector<Selected>) {
  const { artifact } = useArtifactContext();

  const selectedValue = useMemo(() => {
    return selector(artifact);
  }, [artifact, selector]);

  return selectedValue;
}

export function useArtifact() {
  const { artifact, setArtifact } = useArtifactContext();

  return useMemo(
    () => ({
      artifact,
      setArtifact,
    }),
    [artifact, setArtifact],
  );
}
