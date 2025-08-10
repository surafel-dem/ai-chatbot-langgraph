
import { useArtifact } from './use-artifact';
import { textArtifact } from '@/lib/artifacts/text/client';
import type { ArtifactKind } from '@/lib/artifacts/artifact-kind';
import { ChatMessage, DeepResearchReportOutput } from '@/lib/ai/types';
import { ScrollArea } from './ui/scroll-area';

export const artifactDefinitions = [textArtifact];

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  messageId: string;
  isVisible: boolean;
  status: 'streaming' | 'idle';
}

export function Artifact({
  parts
}:{
  parts: ChatMessage["parts"]
}) {
  const { artifact: streamedArtifact } = useArtifact();

  // Assume 1 deep research call per message
let artifactOutput: DeepResearchReportOutput | null = null
let artifactGenerating: boolean = false
for (const part of parts) {

  if (part.type === 'tool-deepResearch' && part.state ==='input-available' ) {
    artifactGenerating = true
  }

  if (part.type === 'tool-deepResearch' && part.state ==='output-available' && part.output.format === 'report') {
    artifactOutput = part.output
  }
}

const artifactContent = artifactOutput?.content || streamedArtifact.content
const artifact: UIArtifact = {
  content: artifactContent,
  isVisible:  Boolean(artifactOutput) || (artifactGenerating && artifactContent !== ''),
  status: artifactOutput ? 'idle' : streamedArtifact.status,
  title: artifactOutput?.title || streamedArtifact.title,
  kind: artifactOutput?.kind || streamedArtifact.kind,
  documentId: "", // use document id for more than 1 artifact per message
  messageId: "", // use message id for more than 1 artifact per message
}


  if (!artifact.isVisible) {
    return null;
  }


  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  return (
    <div data-testid="artifact" className="mt-4 border rounded-lg bg-background">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">{artifact.title}</h3>
      </div>
      <div className="p-4">
        <ScrollArea className="h-[600px]">
          <artifactDefinition.content content={artifact.content} />
        </ScrollArea>
      </div>
    </div>
  );
}

