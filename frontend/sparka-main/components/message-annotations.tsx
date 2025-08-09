import { ReasonSearchResearchProgress } from './deep-research-progress';
import type {
  WebSearchUpdate,
  ResearchUpdate,
} from '@/lib/ai/tools/research-updates-schema';
import { Sources } from './sources';
import type { ChatMessage } from '@/lib/ai/types';

export const SourcesAnnotations = ({
  parts,
}: { parts?: ChatMessage['parts'] }) => {
  if (!parts) return null;

  const researchUpdates = parts
    .filter((part) => part.type === 'data-researchUpdate')
    .map((u) => u.data);

  if (researchUpdates.length === 0) return null;

  const researchCompleted = researchUpdates.find((u) => u.type === 'completed');

  if (!researchCompleted) return null;

  const webSearchUpdates = researchUpdates
    .filter<WebSearchUpdate>((u) => u.type === 'web')
    .filter((u) => u.results)
    .flatMap((u) => u.results)
    .filter((u) => u !== undefined);

  const deduppedSources = webSearchUpdates.filter(
    (source, index, self) =>
      index === self.findIndex((t) => t.url === source.url),
  );

  return <Sources sources={deduppedSources} />;
};

// Render a given list of research updates (already grouped/filtered)
export const ResearchUpdates = ({
  updates,
}: {
  updates: ResearchUpdate[] | undefined;
}) => {
  if (!updates || updates.length === 0) return null;
  return <ReasonSearchResearchProgress updates={updates} />;
};
