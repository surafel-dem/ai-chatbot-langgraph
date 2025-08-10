import type { DeepResearchConfig } from './configuration';
import { createDeepResearchConfig } from './configuration';
import { runDeepResearcher } from './deep-researcher';
import { tool, type ModelMessage } from 'ai';
import { z } from 'zod';
import type { StreamWriter } from '../../types';

export const deepResearch = ({
  dataStream,
  messageId,
  messages,
}: {
  dataStream: StreamWriter;
  messageId: string;
  messages: ModelMessage[];
}) =>
  tool({
    description: `Conducts deep, autonomous research based on a conversation history. It automatically clarifies the user's intent if the request is ambiguous, breaks down the query into parallel research tasks, scours multiple web sources for information, and then synthesizes the findings into a comprehensive, well-structured report with citations. This is best for complex questions that require in-depth analysis and a detailed answer, not just a simple search. 
    
    
Important:
- If a message with role tool and toolname "deepResearch" is found in the conversation history, and this tool has an output with format "clarifying_questions", you must call this tool again to continue the research process.
- If research is successful, a report will be created by this tool and displayed to the user. No need to repeat it in your answer.
    
Use for:
- Start a research or to continue a research process
- Perform deep research (also autonomous research, deep search, or similar aliases)
- Use again if this tool was previously used, produced a clarifying question, and the user has now responded
`,
    inputSchema: z.object({}),
    execute: async () => {
      // Load default config (can be overridden via createDeepResearchConfig({...}))
      const config: DeepResearchConfig = createDeepResearchConfig();

      try {
        const researchResult = await runDeepResearcher(
          {
            requestId: messageId,
            messages: messages,
          },
          config,
          dataStream,
        );

        switch (researchResult.type) {
          case 'report':
            return {
              ...researchResult.data,
              format: 'report' as const,
            };

          case 'clarifying_question':
            return {
              answer: researchResult.data,
              format: 'clarifying_questions' as const,
            };
        }
      } catch (error) {
        console.error('Deep research error:', error);
        return {
          answer: `Deep research failed with error: ${error instanceof Error ? error.message : String(error)}`,
          format: 'problem' as const,
        };
      }
    },
  });
