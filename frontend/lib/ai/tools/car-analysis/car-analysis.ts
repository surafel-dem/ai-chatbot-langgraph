import type { CarAnalysisConfig } from './configuration';
import { createCarAnalysisConfig } from './configuration';
import { runCarAnalyst } from './car-analyst';
import { tool, type ModelMessage } from 'ai';
import { z } from 'zod';
import type { StreamWriter } from '../../types';

export const carAnalysis = ({
  dataStream,
  messageId,
  messages,
}: {
  dataStream: StreamWriter;
  messageId: string;
  messages: ModelMessage[];
}) =>
  tool({
    description: `Conducts comprehensive car analysis based on a conversation history. It automatically clarifies the user's intent if the car details are ambiguous, analyzes the car across three specialist areas (purchase advice, running costs, and reliability), and then synthesizes the findings into a comprehensive, well-structured report with citations. This is best for car analysis questions that require in-depth evaluation across multiple aspects.
    
Important:
- If a message with role tool and toolname "carAnalysis" is found in the conversation history, and this tool has an output with format "clarifying_questions", you must call this tool again to continue the analysis process.
- If analysis is successful, a report will be created by this tool and displayed to the user. No need to repeat it in your answer.
    
Use for:
- Start a car analysis or to continue an analysis process
- Perform comprehensive car evaluation (purchase advice, running costs, reliability)
- Use again if this tool was previously used, produced a clarifying question, and the user has now responded
`,
    inputSchema: z.object({}),
    execute: async () => {
      // Load default config
      const config: CarAnalysisConfig = createCarAnalysisConfig();

      try {
        const analysisResult = await runCarAnalyst(
          {
            requestId: messageId,
            messages: messages,
          },
          config,
          dataStream,
        );

        switch (analysisResult.type) {
          case 'report':
            return {
              ...analysisResult.data,
              format: 'report' as const,
            };

          case 'clarifying_question':
            return {
              answer: analysisResult.data,
              format: 'clarifying_questions' as const,
            };
        }
      } catch (error) {
        console.error('Car analysis error:', error);
        return {
          answer: `Car analysis failed with error: ${error instanceof Error ? error.message : String(error)}`,
          format: 'problem' as const,
        };
      }
    },
  });