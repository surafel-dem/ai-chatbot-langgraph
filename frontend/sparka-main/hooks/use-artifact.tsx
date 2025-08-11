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
  boundingBox: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
};

type Selector<T> = (state: UIArtifact) => T;

interface ArtifactContextType {
  artifact: UIArtifact;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact),
  ) => void;
  metadata: Record<string, any> | null;
  setMetadata: (
    documentId: string,
    metadata:
      | Record<string, any>
      | null
      | ((current: Record<string, any> | null) => Record<string, any> | null),
  ) => void;
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(
  undefined,
);

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [artifact, setArtifactState] =
    useState<UIArtifact>(initialArtifactData);
  const [metadataStore, setMetadataStore] = useState<Record<
    string,
    any
  > | null>(null);

  console.log('metadataStore', metadataStore);

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

  const setMetadata = useCallback(
    (documentId: string, metadata: any | ((current: any) => any)) => {
      setMetadataStore((current) => ({
        ...current,
        [documentId]:
          typeof metadata === 'function'
            ? metadata(current ? current[documentId] : null)
            : metadata,
      }));
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      artifact,
      setArtifact,
      metadata: metadataStore,
      setMetadata,
    }),
    [artifact, setArtifact, metadataStore, setMetadata],
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
  const {
    artifact,
    setArtifact,
    metadata: metadataStore,
    setMetadata: setMetadataStore,
  } = useArtifactContext();

  const metadata = useMemo(() => {
    return artifact.documentId ? metadataStore?.[artifact.documentId] : null;
  }, [metadataStore, artifact.documentId]);

  const setMetadata = useCallback(
    (metadata: any | ((current: any) => any)) => {
      if (artifact.documentId) {
        setMetadataStore(artifact.documentId, metadata);
      }
    },
    [artifact.documentId, setMetadataStore],
  );

  return useMemo(
    () => ({
      artifact,
      setArtifact,
      metadata,
      setMetadata,
    }),
    [artifact, setArtifact, metadata, setMetadata],
  );
}
