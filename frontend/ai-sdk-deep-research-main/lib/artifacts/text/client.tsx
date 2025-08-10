import { Artifact } from '@/components/create-artifact';
import { Markdown } from '@/components/markdown';

export const textArtifact = new Artifact<'text', {}>({
  kind: 'text',
  description: 'Useful for text content, like drafting essays and emails.',
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'data-textDelta') {
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + (streamPart.data as string),
          isVisible:
            draftArtifact.status === 'streaming' &&
            draftArtifact.content.length > 400 &&
            draftArtifact.content.length < 450
              ? true
              : draftArtifact.isVisible,
          status: 'streaming',
        };
      });
    }
  },
  content: ({ content }) => {
    return (
      <Markdown>{content}</Markdown>
    );
  },
});
