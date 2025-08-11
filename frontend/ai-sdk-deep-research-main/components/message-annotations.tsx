import { ReasonSearchResearchProgress } from '@/components/deep-research-progress';
import type { WebSearchUpdate } from '@/lib/ai/tools/research-updates-schema';
import type { ChatMessage } from '@/lib/ai/types';


export const ResearchUpdateAnnotations = ({
  parts,
}: { parts?: ChatMessage['parts'] }) => {
  if (!parts) return null;

  const researchUpdates = parts
    .filter((part) => part.type === 'data-researchUpdate')
    .map((u) => u.data);

  console.log('researchUpdates', researchUpdates);
  if (researchUpdates.length === 0) return null;

  return <ReasonSearchResearchProgress updates={researchUpdates} />;
};
