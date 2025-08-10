import { generateObject, generateText, type ModelMessage } from 'ai';
import { getLanguageModel } from '@/lib/ai/providers';
import { truncateMessages } from '@/lib/ai/token-utils';
import type { ModelId } from '@/lib/ai/model-id';
import { z } from 'zod';
import type { DeepResearchConfig } from './configuration';
import {
  type AgentState,
  type AgentInputState,
  type SupervisorState,
  type ResearcherState,
  type ResearcherOutputState,
  ClarifyWithUserSchema,
  ResearchQuestionSchema,
  leadResearcherTools,
  type ResponseMessage,
  type ClarifyWithUserInput,
  type WriteResearchBriefInput,
  type WriteResearchBriefOutput,
  type SupervisorInput,
  type SupervisorOutput,
  type SupervisorToolsInput,
  type SupervisorToolsOutput,
  type ResearcherInput,
  type CompressResearchInput,
  type DeepResearchResult,
} from './state';
import {
  clarifyWithUserInstructions,
  transformMessagesIntoResearchTopicPrompt,
  researchSystemPrompt,
  compressResearchSystemPrompt,
  compressResearchSimpleHumanMessage,
  finalReportGenerationPrompt,
  leadResearcherPrompt,
  statusUpdatePrompt,
} from './prompts';
import {
  getTodayStr,
  getModelContextWindow,
  getAllTools,
  getNotesFromToolCalls,
} from './utils';
import type { StreamWriter } from '../../types';
import { generateUUID, getTextContentFromModelMessage } from '@/lib/utils';
import { createDocument } from '../create-document';

import { ReportDocumentWriter } from '@/lib/artifacts/text/reportServer';

// Agent result types (instead of commands)
type ClarificationResult =
  | { needsClarification: true; clarificationMessage: string }
  | { needsClarification: false };

type SupervisorResult = {
  status: 'complete';
  data: { notes: string[] };
};

function messagesToString(messages: ModelMessage[]): string {
  return messages
    .map((m) => `${m.role}: ${JSON.stringify(m.content)}`)
    .join('\n');
}

async function generateStatusUpdate(
  actionType: string,
  messages: ModelMessage[],
  config: DeepResearchConfig,
  context?: string,
): Promise<{ title: string; message: string }> {
  const model = getLanguageModel(config.research_model as ModelId);

  const messagesContent = messagesToString(messages);
  const contextInfo = context ? `\n\nAdditional context: ${context}` : '';

  const prompt = statusUpdatePrompt({
    actionType,
    messagesContent,
    contextInfo,
  });

  const result = await generateObject({
    model,
    schema: z.object({
      title: z
        .string()
        .describe(
          'A specific, action-focused title reflecting what just completed (max 50 characters). Avoid generic "I\'m researching" phrases.',
        ),
      message: z
        .string()
        .describe(
          'A concrete description of what was accomplished in this step, including specific details, numbers, or findings when available (max 200 characters)',
        ),
    }),
    messages: [{ role: 'user', content: prompt }],
    maxOutputTokens: 200,
  });

  return result.object;
}

// Helper function to filter messages by type
function filterMessages(
  messages: ModelMessage[],
  includeTypes: string[],
): ModelMessage[] {
  return messages.filter((m) => includeTypes.includes(m.role));
}

async function clarifyWithUser(
  state: ClarifyWithUserInput,
  config: DeepResearchConfig,
): Promise<ClarificationResult> {
  if (!config.allow_clarification) {
    return { needsClarification: false };
  }

  const messages = state.messages;
  const model = getLanguageModel(config.research_model as ModelId);

  // Get model token limit and reserve space for output tokens
  const clarifyModelContextWindow = getModelContextWindow(
    config.research_model as ModelId,
  );

  // Create messages and truncate to fit within token limit
  const clarifyMessages = [
    {
      role: 'user' as const,
      content: clarifyWithUserInstructions({
        messages: messagesToString(messages),
        date: getTodayStr(),
      }),
    },
  ];
  const truncatedClarifyMessages = truncateMessages(
    clarifyMessages,
    clarifyModelContextWindow,
  );

  const response = await generateObject({
    model,
    schema: ClarifyWithUserSchema,
    messages: truncatedClarifyMessages,
    maxOutputTokens: config.research_model_max_tokens,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'clarifyWithUser',
      metadata: {
        requestId: state.requestId || '',
      },
    },
  });

  if (response.object.need_clarification) {
    return {
      needsClarification: true,
      clarificationMessage: response.object.question,
    };
  } else {
    return { needsClarification: false };
  }
}

async function writeResearchBrief(
  state: WriteResearchBriefInput,
  config: DeepResearchConfig,
  dataStream: StreamWriter,
): Promise<WriteResearchBriefOutput> {
  const model = getLanguageModel(config.research_model as ModelId);
  const dataPartId = generateUUID();
  dataStream.write({
    id: dataPartId,
    type: 'data-researchUpdate',
    data: {
      title: 'Writing research brief',
      type: 'writing',
      status: 'running',
    },
  });

  // Get model token limit and reserve space for output tokens
  const briefModelContextWindow = getModelContextWindow(
    config.research_model as ModelId,
  );

  // Create messages and truncate to fit within token limit
  const briefMessages = [
    {
      role: 'user' as const,
      content: transformMessagesIntoResearchTopicPrompt({
        messages: messagesToString(state.messages || []),
        date: getTodayStr(),
      }),
    },
  ];
  const truncatedBriefMessages = truncateMessages(
    briefMessages,
    briefModelContextWindow,
  );

  const result = await generateObject({
    model,
    schema: ResearchQuestionSchema,
    messages: truncatedBriefMessages,
    maxOutputTokens: config.research_model_max_tokens,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'writeResearchBrief',
      metadata: {
        requestId: state.requestId || '',
      },
    },
  });

  dataStream.write({
    id: dataPartId,
    type: 'data-researchUpdate',
    data: {
      title: 'Writing research brief',
      message: result.object.research_brief,
      type: 'writing',
      status: 'completed',
    },
  });

  return {
    research_brief: result.object.research_brief,
    title: result.object.title,
  };
}

// Agent base class
abstract class Agent {
  protected agentId: string;

  constructor(
    protected config: DeepResearchConfig,
    protected dataStream: StreamWriter,
  ) {
    this.agentId = generateUUID();
  }
}

// Researcher Agent class
class ResearcherAgent extends Agent {
  private async research(
    state: ResearcherInput,
  ): Promise<CompressResearchInput> {
    console.log('=== RESEARCHER START ===', {
      research_topic: state.research_topic,
      messages_count: state.researcher_messages?.length || 0,
    });

    const researcherMessages = state.researcher_messages || [];
    const tools = await getAllTools(
      this.config,
      this.dataStream,
      state.requestId,
    );
    if (Object.keys(tools).length === 0) {
      throw new Error(
        'No tools found to conduct research: Please configure either your search API or add MCP tools to your configuration.',
      );
    }

    this.dataStream.write({
      type: 'data-researchUpdate',
      data: {
        title: `Starting research on topic`,
        message: state.research_topic,
        type: 'thoughts',
        status: 'completed',
      },
    });

    // Get model token limit and reserve space for output tokens
    const researchModelContextWindow = getModelContextWindow(
      this.config.research_model as ModelId,
    );

    // Truncate messages to fit within token limit
    const truncatedResearcherMessages = truncateMessages(
      researcherMessages,
      researchModelContextWindow,
    );

    const result = await generateText({
      model: getLanguageModel(this.config.research_model as ModelId),
      messages: truncatedResearcherMessages,
      tools,
      maxOutputTokens: this.config.research_model_max_tokens,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'researcher',
        metadata: {
          requestId: state.requestId || '',
          agentId: this.agentId,
        },
      },
    });

    const completedUpdate = await generateStatusUpdate(
      'research_completion',
      [...researcherMessages, ...result.response.messages],
      this.config,
      `Research phase completed with ${result.response.messages.length} new messages`,
    );

    this.dataStream.write({
      type: 'data-researchUpdate',
      data: {
        title: completedUpdate.title,
        type: 'thoughts',
        message: completedUpdate.message,
        status: 'completed',
      },
    });

    return {
      requestId: state.requestId,
      researcher_messages: [...researcherMessages, ...result.response.messages],
    };
  }

  private async compressResearch(
    state: CompressResearchInput,
  ): Promise<ResearcherOutputState> {
    const model = getLanguageModel(this.config.compression_model as ModelId);

    const researcherMessages = [...(state.researcher_messages || [])];

    // Update the system prompt to focus on compression
    researcherMessages[0] = {
      role: 'system' as const,
      content: compressResearchSystemPrompt({ date: getTodayStr() }),
    };
    researcherMessages.push({
      role: 'user' as const,
      content: compressResearchSimpleHumanMessage,
    });

    // Get model token limit and reserve space for output tokens
    const compressionModelContextWindow = getModelContextWindow(
      this.config.compression_model as ModelId,
    );

    // Truncate messages to fit within token limit
    const truncatedMessages = truncateMessages(
      researcherMessages,
      compressionModelContextWindow,
    );

    const response = await generateText({
      model,
      messages: truncatedMessages,
      maxOutputTokens: this.config.compression_model_max_tokens,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'compressResearch',
        metadata: {
          requestId: state.requestId || '',
          agentId: this.agentId,
        },
      },
      maxRetries: 3,
    });

    const completedUpdate = await generateStatusUpdate(
      'research_compression',
      truncatedMessages,
      this.config,
      `Compressed ${researcherMessages.length} messages into summary`,
    );

    this.dataStream.write({
      type: 'data-researchUpdate',
      data: {
        title: completedUpdate.title,
        type: 'thoughts',
        message: completedUpdate.message,
        status: 'completed',
      },
    });

    return {
      compressed_research: response.response.messages
        .map((m) => getTextContentFromModelMessage(m))
        .join('\n'),
      raw_notes: [
        filterMessages(researcherMessages, ['tool', 'assistant'])
          .map((m) => String(m.content))
          .join('\n'),
      ],
    };
  }

  async executeResearchSubgraph(
    initialState: ResearcherState,
  ): Promise<ResearcherOutputState> {
    const result = await this.research({
      requestId: initialState.requestId,
      researcher_messages: initialState.researcher_messages,
      research_topic: initialState.research_topic,
      tool_call_iterations: initialState.tool_call_iterations,
    });

    return await this.compressResearch({
      requestId: initialState.requestId,
      researcher_messages: result.researcher_messages,
    });
  }
}

// Supervisor Agent class
class SupervisorAgent extends Agent {
  private researcherAgent: ResearcherAgent;

  constructor(config: DeepResearchConfig, dataStream: StreamWriter) {
    super(config, dataStream);
    this.researcherAgent = new ResearcherAgent(config, dataStream);
  }

  private async supervise(state: SupervisorInput): Promise<SupervisorOutput> {
    console.log('=== SUPERVISOR START ===', {
      research_iterations: state.research_iterations,
      max_iterations: this.config.max_researcher_iterations,
      messages_count: state.supervisor_messages?.length || 0,
    });

    const model = getLanguageModel(this.config.research_model as ModelId);

    // Get model token limit and reserve space for output tokens
    const supervisorModelContextWindow = getModelContextWindow(
      this.config.research_model as ModelId,
    );

    // Truncate messages to fit within token limit
    const truncatedSupervisorMessages = truncateMessages(
      state.supervisor_messages,
      supervisorModelContextWindow,
    );

    const result = await generateText({
      model,
      messages: truncatedSupervisorMessages,
      tools: leadResearcherTools,
      maxOutputTokens: this.config.research_model_max_tokens,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'supervisor',
        metadata: {
          requestId: state.requestId || '',
          agentId: this.agentId,
        },
      },
      // TODO: Do we need a stop when?
      //   stopWhen: ,
    });

    const lastAssistantMessage = result.response.messages.find(
      (m) => m.role === 'assistant',
    );

    const supervisorMessageText =
      lastAssistantMessage &&
      getTextContentFromModelMessage(lastAssistantMessage);

    const completedUpdate = await generateStatusUpdate(
      'supervisor_evaluation',
      truncatedSupervisorMessages,
      this.config,
      supervisorMessageText || 'Coordinated investigation efforts',
    );

    this.dataStream.write({
      type: 'data-researchUpdate',
      data: {
        title: completedUpdate.title,
        message: completedUpdate.message,
        type: 'thoughts',
        status: 'completed',
      },
    });

    const responseMessages = result.response.messages;
    if (result.finishReason !== 'tool-calls') {
      console.dir(result, { depth: null });
      throw new Error(`Expected tool calls, but got: $result.finishReason`);
    }
    return {
      supervisor_messages: [
        ...(state.supervisor_messages || []),
        ...responseMessages,
      ],
      tool_calls: result.toolCalls || [],
      research_iterations: (state.research_iterations || 0) + 1,
    };
  }

  async runSupervisorGraph(
    initialState: SupervisorState,
  ): Promise<SupervisorResult> {
    let supervisorState: SupervisorInput = {
      requestId: initialState.requestId,
      supervisor_messages: initialState.supervisor_messages,
      research_brief: initialState.research_brief,
      notes: initialState.notes,
      research_iterations: initialState.research_iterations,
      raw_notes: initialState.raw_notes,
      tool_calls: initialState.tool_calls,
    };

    while (true) {
      const supervisorResult = await this.supervise(supervisorState);

      // Create the input for executeTools with all required fields
      const toolsInput: SupervisorToolsInput = {
        requestId: supervisorState.requestId,
        supervisor_messages: supervisorResult.supervisor_messages,
        research_brief: supervisorState.research_brief,
        research_iterations: supervisorResult.research_iterations,
        tool_calls: supervisorResult.tool_calls,
      };

      const toolsResult = await this.executeTools(toolsInput);

      if (toolsResult.status === 'complete') {
        return {
          status: 'complete',
          data: {
            notes: toolsResult.data.notes,
          },
        };
      }

      // Merge the data from toolsResult with the current state to create new SupervisorInput
      supervisorState = {
        requestId: supervisorState.requestId,
        research_brief: supervisorState.research_brief,
        notes: supervisorState.notes,
        supervisor_messages: toolsResult.data.supervisor_messages,
        research_iterations: supervisorResult.research_iterations,
        raw_notes: [
          ...supervisorState.raw_notes,
          ...toolsResult.data.raw_notes,
        ],
        tool_calls: [],
      };
    }
  }

  private async executeTools(
    state: SupervisorToolsInput,
  ): Promise<
    | { status: 'complete'; data: { notes: string[] } }
    | { status: 'continue'; data: SupervisorToolsOutput }
  > {
    console.log('=== SUPERVISOR TOOLS START ===', {
      research_iterations: state.research_iterations,
      max_iterations: this.config.max_researcher_iterations,
      tool_calls_count: state.tool_calls?.length || 0,
      tool_names: state.tool_calls?.map((tc) => tc.toolName) || [],
    });

    const supervisorMessages = state.supervisor_messages || [];
    const researchIterations = state.research_iterations || 0;

    // Exit Criteria
    const exceededAllowedIterations =
      researchIterations > this.config.max_researcher_iterations;

    const toolCalls = state.tool_calls;
    const noToolCalls = !toolCalls || toolCalls.length === 0;
    const researchCompleteToolCall = toolCalls?.some(
      (toolCall) => toolCall.toolName === 'researchComplete',
    );

    if (exceededAllowedIterations || noToolCalls || researchCompleteToolCall) {
      return {
        status: 'complete',
        data: {
          notes: getNotesFromToolCalls(supervisorMessages),
        },
      };
    }

    // Otherwise, conduct research and gather results
    const allConductResearchCalls =
      toolCalls?.filter(
        (toolCall) => toolCall.toolName === 'conductResearch',
      ) || [];

    const conductResearchCalls = allConductResearchCalls.slice(
      0,
      this.config.max_concurrent_research_units,
    );
    const overflowConductResearchCalls = allConductResearchCalls.slice(
      this.config.max_concurrent_research_units,
    );

    const researcherSystemPromptText = researchSystemPrompt({
      mcp_prompt: this.config.mcp_prompt || '',
      date: getTodayStr(),
      max_search_queries: this.config.search_api_max_queries,
    });

    const completedUpdate = await generateStatusUpdate(
      'continuing_research_tasks',
      supervisorMessages,
      this.config,
      `Need research the research about the topics [${conductResearchCalls.map((c) => c.input.research_topic).join('], [')}]`,
    );

    this.dataStream.write({
      type: 'data-researchUpdate',
      data: {
        title: completedUpdate.title,
        message: completedUpdate.message,
        type: 'thoughts',
        status: 'completed',
      },
    });
    const toolResults = [];

    // Non parallel execution to avoid streaming race condition and rate limits
    for (const toolCall of conductResearchCalls) {
      const result = await this.researcherAgent.executeResearchSubgraph({
        requestId: state.requestId,
        researcher_messages: [
          { role: 'system' as const, content: researcherSystemPromptText },
          { role: 'user' as const, content: toolCall.input.research_topic },
        ],
        tool_calls: [],
        research_topic: toolCall.input.research_topic,
        tool_call_iterations: 0,
        compressed_research: '',
        raw_notes: [],
      });
      toolResults.push(result);
    }

    const toolResultsMessages: ResponseMessage[] = toolResults.map(
      (observation, index) => ({
        role: 'tool' as const,
        content: [
          {
            toolName: 'conductResearch',
            toolCallId: conductResearchCalls[index].toolCallId,
            type: 'tool-result',
            output: {
              type: 'text',
              value:
                observation.compressed_research ||
                'Error synthesizing research report: Maximum retries exceeded',
            },
          },
        ],
      }),
    );

    // Handle overflow tool calls
    for (const overflowCall of overflowConductResearchCalls) {
      toolResultsMessages.push({
        role: 'tool' as const,
        content: [
          {
            toolName: 'conductResearch',
            toolCallId: overflowCall.toolCallId,
            type: 'tool-result',
            output: {
              type: 'text',
              value: `Error: Did not run this research as you have already exceeded the maximum number of concurrent research units. Please try again with ${this.config.max_concurrent_research_units} or fewer research units.`,
            }, // update depending on the tool's output format
          },
        ],
      });
    }

    const rawNotesConcat = toolResults
      .map((observation) => observation.raw_notes.join('\n'))
      .join('\n');

    return {
      status: 'continue',
      data: {
        supervisor_messages: [...supervisorMessages, ...toolResultsMessages],
        raw_notes: [rawNotesConcat],
      },
    };
  }
}

async function finalReportGeneration(
  state: AgentState,
  config: DeepResearchConfig,
  dataStream: StreamWriter,
  requestId: string,
  reportTitle: string,
): Promise<Pick<AgentState, 'final_report' | 'reportResult'>> {
  const notes = state.notes || [];

  const model = getLanguageModel(config.final_report_model as ModelId);
  const findings = notes.join('\n');

  const finalReportPromptText = finalReportGenerationPrompt({
    research_brief: state.research_brief || '',
    findings,
    date: getTodayStr(),
  });

  const finalReportUpdateId = generateUUID();
  dataStream.write({
    id: finalReportUpdateId,
    type: 'data-researchUpdate',
    data: {
      title: 'Writing final report',
      type: 'writing',
      status: 'running',
    },
  });

  // Get model token limit and reserve space for output tokens
  const finalReportModelContextWindow = getModelContextWindow(
    config.final_report_model as ModelId,
  );

  // Truncate messages to fit within token limit
  const finalReportMessages = [
    { role: 'user' as const, content: finalReportPromptText },
  ];
  const truncatedFinalMessages = truncateMessages(
    finalReportMessages,
    finalReportModelContextWindow,
  );

  const reportDocumentHandler = new ReportDocumentWriter({
    model,
    messages: truncatedFinalMessages,
    maxOutputTokens: config.final_report_model_max_tokens,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'finalReportGeneration',
      metadata: {
        requestId: state.requestId || '',
      },
    },
    maxRetries: 3,
  });

  const reportResult = await createDocument({
    dataStream,
    kind: 'text',
    title: reportTitle,
    description: '',
    prompt: finalReportPromptText,
    messageId: requestId,
    selectedModel: config.final_report_model as ModelId,
    documentHandler: reportDocumentHandler.createDocumentHandler(),
  });

  dataStream.write({
    id: finalReportUpdateId,
    type: 'data-researchUpdate',
    data: {
      title: 'Writing final report',
      type: 'writing',
      status: 'completed',
    },
  });

  return {
    final_report: reportDocumentHandler.getReportContent(),
    reportResult,
  };
}

// Main deep researcher workflow
export async function runDeepResearcher(
  input: AgentInputState,
  config: DeepResearchConfig,
  dataStream: StreamWriter,
): Promise<DeepResearchResult> {
  let currentState: AgentState = {
    requestId: input.requestId,
    inputMessages: input.messages,
    supervisor_messages: [],
    raw_notes: [],
    notes: [],
    final_report: '',
    reportResult: {
      id: '',
      title: '',
      kind: 'text',
      content: '',
    },
  };

  // Step 1: Clarify with user
  const clarifyResult = await clarifyWithUser(
    { requestId: currentState.requestId, messages: currentState.inputMessages },
    config,
  );

  if (clarifyResult.needsClarification) {
    return {
      type: 'clarifying_question',
      data: clarifyResult.clarificationMessage || 'Clarification needed',
    };
  }

  dataStream.write({
    type: 'data-researchUpdate',
    data: {
      title: 'Starting research',
      type: 'started',
      timestamp: Date.now(),
    },
  });

  // Step 2: Write research brief
  const briefResult = await writeResearchBrief(
    { requestId: currentState.requestId, messages: currentState.inputMessages },
    config,
    dataStream,
  );
  currentState.research_brief = briefResult.research_brief;
  const reportTitle = briefResult.title;

  // Step 3: Research supervisor loop
  const supervisorAgent = new SupervisorAgent(config, dataStream);

  const supervisorResult = await supervisorAgent.runSupervisorGraph({
    requestId: currentState.requestId,
    supervisor_messages: [
      {
        role: 'system' as const,
        content: leadResearcherPrompt({
          date: getTodayStr(),
          max_concurrent_research_units: config.max_concurrent_research_units,
        }),
      },
      {
        role: 'user' as const,
        content: briefResult.research_brief,
      },
    ],
    research_brief: currentState.research_brief || '',
    notes: currentState.notes,
    research_iterations: 0,
    raw_notes: currentState.raw_notes,
    tool_calls: [],
  });

  currentState = {
    ...currentState,
    notes: supervisorResult.data.notes,
  };

  // Step 4: Final report generation
  const finalResult = await finalReportGeneration(
    currentState,
    config,
    dataStream,
    currentState.requestId,
    reportTitle,
  );

  dataStream.write({
    type: 'data-researchUpdate',
    data: {
      title: 'Research complete',
      type: 'completed',
      timestamp: Date.now(),
    },
  });

  // Current state might be useful for logging
  // currentState = { ...currentState, ...finalResult };

  // Check if we have a successful report
  return {
    type: 'report',
    data: {
      ...finalResult.reportResult,
      // We return the full report as a part because we don't have artifact storage
      content: finalResult.final_report,
    },
  };
}
