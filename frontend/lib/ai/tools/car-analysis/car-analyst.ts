import { generateObject, generateText, type ModelMessage } from 'ai';
import { getLanguageModel } from '@/lib/ai/providers';
import { truncateMessages } from '@/lib/ai/token-utils';
import type { ModelId } from '@/lib/ai/model-id';
import { z } from 'zod';
import type { CarAnalysisConfig } from './configuration';
import {
  type AgentState,
  type AnalysisInputState,
  type SupervisorState,
  type SpecialistState,
  type SpecialistOutputState,
  ClarifyWithUserSchema,
  CarDetailsSchema,
  supervisorTools,
  type ResponseMessage,
  type ClarifyWithUserInput,
  type WriteAnalysisBriefInput,
  type WriteAnalysisBriefOutput,
  type SupervisorInput,
  type SupervisorOutput,
  type SupervisorToolsInput,
  type SupervisorToolsOutput,
  type SpecialistInput,
  type CompressAnalysisInput,
  type CarAnalysisResult,
} from './state';
import {
  clarifyWithUserInstructions,
  transformMessagesIntoAnalysisTopicPrompt,
  specialistSystemPrompt,
  compressAnalysisSystemPrompt,
  compressAnalysisSimpleHumanMessage,
  finalReportGenerationPrompt,
  supervisorSystemPrompt,
  statusUpdatePrompt,
} from './prompts';
import {
  getTodayStr,
  getModelContextWindow,
  getAllTools,
  getNotesFromToolCalls,
  extractCarDetailsFromMessages,
  generateAnalysisTitle,
} from './utils';
import type { StreamWriter } from '@/lib/ai/types';
import { generateUUID, getTextContentFromModelMessage } from '@/lib/utils';
import { createDocument } from '../create-document';
import { ReportDocumentWriter } from '@/lib/artifacts/text/reportServer';

// Agent result types
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
  config: CarAnalysisConfig,
  context?: string,
): Promise<{ title: string; message: string }> {
  const model = getLanguageModel(config.analysis_model as ModelId);

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
          'A specific, action-focused title reflecting what just completed (max 50 characters). Avoid generic phrases.',
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
  config: CarAnalysisConfig,
): Promise<ClarificationResult> {
  if (!config.allow_clarification) {
    return { needsClarification: false };
  }

  const messages = state.messages;
  const model = getLanguageModel(config.analysis_model as ModelId);

  // Get model token limit and reserve space for output tokens
  const clarifyModelContextWindow = getModelContextWindow(
    config.analysis_model as ModelId,
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
    maxOutputTokens: config.analysis_model_max_tokens,
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

async function writeAnalysisBrief(
  state: WriteAnalysisBriefInput,
  config: CarAnalysisConfig,
  dataStream: StreamWriter,
): Promise<WriteAnalysisBriefOutput> {
  const model = getLanguageModel(config.analysis_model as ModelId);
  const dataPartId = generateUUID();
  dataStream.write({
    id: dataPartId,
    type: 'data-carAnalysisUpdate',
    data: {
      title: 'Writing analysis brief',
      type: 'writing',
      status: 'running',
    },
  });

  // Extract car details from messages
  const extractedDetails = extractCarDetailsFromMessages(state.messages || []);

  // Get model token limit and reserve space for output tokens
  const briefModelContextWindow = getModelContextWindow(
    config.analysis_model as ModelId,
  );

  // Create messages and truncate to fit within token limit
  const briefMessages = [
    {
      role: 'user' as const,
      content: transformMessagesIntoAnalysisTopicPrompt({
        messages: messagesToString(state.messages || []),
        date: getTodayStr(),
      }),
    },
  ];
  const truncatedBriefMessages = truncateMessages(
    briefMessages,
    briefModelContextWindow,
  );

  const AnalysisBriefSchema = z.object({
    analysis_brief: z.string().describe('Brief description of the analysis needed'),
    title: z.string().describe('Title for the analysis report'),
    car_details: CarDetailsSchema,
  });

  const result = await generateObject({
    model,
    schema: AnalysisBriefSchema,
    messages: truncatedBriefMessages,
    maxOutputTokens: config.analysis_model_max_tokens,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'writeAnalysisBrief',
      metadata: {
        requestId: state.requestId || '',
      },
    },
  });

  dataStream.write({
    id: dataPartId,
    type: 'data-carAnalysisUpdate',
    data: {
      title: 'Writing analysis brief',
      message: result.object.analysis_brief,
      type: 'writing',
      status: 'completed',
    },
  });

  return {
    analysis_brief: result.object.analysis_brief,
    car_details: result.object.car_details,
    title: result.object.title,
  };
}

// Agent base class
abstract class Agent {
  protected agentId: string;

  constructor(
    protected config: CarAnalysisConfig,
    protected dataStream: StreamWriter,
  ) {
    this.agentId = generateUUID();
  }
}

// Specialist Agent class
class SpecialistAgent extends Agent {
  private async analyzeSpecialist(
    state: SpecialistInput,
  ): Promise<CompressAnalysisInput> {
    console.log('=== SPECIALIST START ===', {
      analysis_topic: state.analysis_topic,
      messages_count: state.specialist_messages?.length || 0,
    });

    const specialistMessages = state.specialist_messages || [];
    const tools = await getAllTools(
      this.config,
      this.dataStream,
      state.requestId,
    );
    if (Object.keys(tools).length === 0) {
      throw new Error(
        'No tools found to conduct analysis: Please configure car analysis tools.',
      );
    }

    this.dataStream.write({
      type: 'data-carAnalysisUpdate',
      data: {
        title: `Starting ${state.analysis_topic} analysis`,
        message: `${state.car_details.make} ${state.car_details.model} ${state.car_details.year}`,
        type: 'thoughts',
        status: 'completed',
      },
    });

    // Get model token limit and reserve space for output tokens
    const analysisModelContextWindow = getModelContextWindow(
      this.config.analysis_model as ModelId,
    );

    // Truncate messages to fit within token limit
    const truncatedSpecialistMessages = truncateMessages(
      specialistMessages,
      analysisModelContextWindow,
    );

    const result = await generateText({
      model: getLanguageModel(this.config.analysis_model as ModelId),
      messages: truncatedSpecialistMessages,
      tools,
      maxOutputTokens: this.config.analysis_model_max_tokens,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'specialist',
        metadata: {
          requestId: state.requestId || '',
          agentId: this.agentId,
        },
      },
    });

    const completedUpdate = await generateStatusUpdate(
      'analysis_completion',
      [...specialistMessages, ...result.response.messages],
      this.config,
      `${state.analysis_topic} analysis completed with ${result.response.messages.length} new messages`,
    );

    this.dataStream.write({
      type: 'data-carAnalysisUpdate',
      data: {
        title: completedUpdate.title,
        type: 'thoughts',
        message: completedUpdate.message,
        status: 'completed',
      },
    });

    return {
      requestId: state.requestId,
      specialist_messages: [...specialistMessages, ...result.response.messages],
    };
  }

  private async compressAnalysis(
    state: CompressAnalysisInput,
  ): Promise<SpecialistOutputState> {
    const model = getLanguageModel(this.config.compression_model as ModelId);

    const specialistMessages = [...(state.specialist_messages || [])];

    // Update the system prompt to focus on compression
    specialistMessages[0] = {
      role: 'system' as const,
      content: compressAnalysisSystemPrompt({ date: getTodayStr() }),
    };
    specialistMessages.push({
      role: 'user' as const,
      content: compressAnalysisSimpleHumanMessage,
    });

    // Get model token limit and reserve space for output tokens
    const compressionModelContextWindow = getModelContextWindow(
      this.config.compression_model as ModelId,
    );

    // Truncate messages to fit within token limit
    const truncatedMessages = truncateMessages(
      specialistMessages,
      compressionModelContextWindow,
    );

    const response = await generateText({
      model,
      messages: truncatedMessages,
      maxOutputTokens: this.config.compression_model_max_tokens,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'compressAnalysis',
        metadata: {
          requestId: state.requestId || '',
          agentId: this.agentId,
        },
      },
      maxRetries: 3,
    });

    const completedUpdate = await generateStatusUpdate(
      'analysis_compression',
      truncatedMessages,
      this.config,
      `Compressed ${specialistMessages.length} messages into summary`,
    );

    this.dataStream.write({
      type: 'data-carAnalysisUpdate',
      data: {
        title: completedUpdate.title,
        type: 'thoughts',
        message: completedUpdate.message,
        status: 'completed',
      },
    });

    return {
      compressed_analysis: response.response.messages
        .map((m) => getTextContentFromModelMessage(m))
        .join('\n'),
      raw_notes: [
        filterMessages(specialistMessages, ['tool', 'assistant'])
          .map((m) => String(m.content))
          .join('\n'),
      ],
    };
  }

  async executeSpecialistSubgraph(
    initialState: SpecialistState,
  ): Promise<SpecialistOutputState> {
    const result = await this.analyzeSpecialist({
      requestId: initialState.requestId,
      specialist_messages: initialState.specialist_messages,
      analysis_topic: initialState.analysis_topic,
      tool_call_iterations: initialState.tool_call_iterations,
    });

    return await this.compressAnalysis({
      requestId: initialState.requestId,
      specialist_messages: result.specialist_messages,
    });
  }
}

// Supervisor Agent class  
class SupervisorAgent extends Agent {
  private specialistAgent: SpecialistAgent;

  constructor(config: CarAnalysisConfig, dataStream: StreamWriter) {
    super(config, dataStream);
    this.specialistAgent = new SpecialistAgent(config, dataStream);
  }

  private async supervise(state: SupervisorInput): Promise<SupervisorOutput> {
    console.log('=== SUPERVISOR START ===', {
      analysis_iterations: state.analysis_iterations,
      max_iterations: this.config.max_specialist_iterations,
      messages_count: state.supervisor_messages?.length || 0,
    });

    const model = getLanguageModel(this.config.analysis_model as ModelId);

    // Get model token limit and reserve space for output tokens
    const supervisorModelContextWindow = getModelContextWindow(
      this.config.analysis_model as ModelId,
    );

    // Truncate messages to fit within token limit
    const truncatedSupervisorMessages = truncateMessages(
      state.supervisor_messages,
      supervisorModelContextWindow,
    );

    const result = await generateText({
      model,
      messages: truncatedSupervisorMessages,
      tools: supervisorTools,
      maxOutputTokens: this.config.analysis_model_max_tokens,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'supervisor',
        metadata: {
          requestId: state.requestId || '',
          agentId: this.agentId,
        },
      },
    });

    const lastAssistantMessage = result.response.messages.find(
      (m) => m.role === 'assistant',
    );

    const supervisorMessageText =
      lastAssistantMessage &&
      getTextContentFromModelMessage(lastAssistantMessage);

    const completedUpdate = await generateStatusUpdate(
      'supervisor_coordination',
      truncatedSupervisorMessages,
      this.config,
      supervisorMessageText || 'Coordinated analysis efforts',
    );

    this.dataStream.write({
      type: 'data-carAnalysisUpdate',
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
      throw new Error(`Expected tool calls, but got: ${result.finishReason}`);
    }
    return {
      supervisor_messages: [
        ...(state.supervisor_messages || []),
        ...responseMessages,
      ],
      tool_calls: result.toolCalls || [],
      analysis_iterations: (state.analysis_iterations || 0) + 1,
    };
  }

  async runSupervisorGraph(
    initialState: SupervisorState,
  ): Promise<SupervisorResult> {
    let supervisorState: SupervisorInput = {
      requestId: initialState.requestId,
      supervisor_messages: initialState.supervisor_messages,
      analysis_brief: initialState.analysis_brief,
      car_details: initialState.car_details,
      notes: initialState.notes,
      analysis_iterations: initialState.analysis_iterations,
      raw_notes: initialState.raw_notes,
      tool_calls: initialState.tool_calls,
    };

    while (true) {
      const supervisorResult = await this.supervise(supervisorState);

      // Create the input for executeTools with all required fields
      const toolsInput: SupervisorToolsInput = {
        requestId: supervisorState.requestId,
        supervisor_messages: supervisorResult.supervisor_messages,
        analysis_brief: supervisorState.analysis_brief,
        car_details: supervisorState.car_details,
        analysis_iterations: supervisorResult.analysis_iterations,
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
        analysis_brief: supervisorState.analysis_brief,
        car_details: supervisorState.car_details,
        notes: supervisorState.notes,
        supervisor_messages: toolsResult.data.supervisor_messages,
        analysis_iterations: supervisorResult.analysis_iterations,
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
      analysis_iterations: state.analysis_iterations,
      max_iterations: this.config.max_specialist_iterations,
      tool_calls_count: state.tool_calls?.length || 0,
      tool_names: state.tool_calls?.map((tc) => tc.toolName) || [],
    });

    const supervisorMessages = state.supervisor_messages || [];
    const analysisIterations = state.analysis_iterations || 0;

    // Exit Criteria
    const exceededAllowedIterations =
      analysisIterations > this.config.max_specialist_iterations;

    const toolCalls = state.tool_calls;
    const noToolCalls = !toolCalls || toolCalls.length === 0;
    const analysisCompleteToolCall = toolCalls?.some(
      (toolCall) => toolCall.toolName === 'analysis_complete',
    );

    if (exceededAllowedIterations || noToolCalls || analysisCompleteToolCall) {
      return {
        status: 'complete',
        data: {
          notes: getNotesFromToolCalls(supervisorMessages),
        },
      };
    }

    // Get all specialist analysis calls
    const allSpecialistCalls =
      toolCalls?.filter(
        (toolCall) => ['analyze_purchase', 'analyze_running_costs', 'analyze_reliability'].includes(toolCall.toolName),
      ) || [];

    const specialistCalls = allSpecialistCalls.slice(
      0,
      this.config.max_concurrent_specialists,
    );
    const overflowSpecialistCalls = allSpecialistCalls.slice(
      this.config.max_concurrent_specialists,
    );

    const specialistSystemPromptText = specialistSystemPrompt({
      date: getTodayStr(),
      web_search_max_queries: this.config.web_search_max_queries,
    });

    const completedUpdate = await generateStatusUpdate(
      'continuing_specialist_analysis',
      supervisorMessages,
      this.config,
      `Running specialist analysis: [${specialistCalls.map((c) => c.toolName).join(', ')}]`,
    );

    this.dataStream.write({
      type: 'data-carAnalysisUpdate',
      data: {
        title: completedUpdate.title,
        message: completedUpdate.message,
        type: 'thoughts',
        status: 'completed',
      },
    });
    const toolResults = [];

    // Non parallel execution to avoid streaming race condition and rate limits
    for (const toolCall of specialistCalls) {
      const result = await this.specialistAgent.executeSpecialistSubgraph({
        requestId: state.requestId,
        specialist_messages: [
          { role: 'system' as const, content: specialistSystemPromptText },
          { 
            role: 'user' as const, 
            content: `Conduct ${toolCall.toolName.replace('analyze_', '')} analysis for ${state.car_details.make} ${state.car_details.model} ${state.car_details.year}. Analysis brief: ${state.analysis_brief}` 
          },
        ],
        tool_calls: [],
        analysis_topic: toolCall.toolName.replace('analyze_', ''),
        car_details: state.car_details,
        tool_call_iterations: 0,
        compressed_analysis: '',
        raw_notes: [],
      });
      toolResults.push(result);
    }

    const toolResultsMessages: ResponseMessage[] = toolResults.map(
      (observation, index) => ({
        role: 'tool' as const,
        content: [
          {
            toolName: specialistCalls[index].toolName,
            toolCallId: specialistCalls[index].toolCallId,
            type: 'tool-result',
            output: {
              type: 'text',
              value:
                observation.compressed_analysis ||
                'Error analyzing: Maximum retries exceeded',
            },
          },
        ],
      }),
    );

    // Handle overflow tool calls
    for (const overflowCall of overflowSpecialistCalls) {
      toolResultsMessages.push({
        role: 'tool' as const,
        content: [
          {
            toolName: overflowCall.toolName,
            toolCallId: overflowCall.toolCallId,
            type: 'tool-result',
            output: {
              type: 'text',
              value: `Error: Did not run this analysis as you have already exceeded the maximum number of concurrent specialists. Please try again with ${this.config.max_concurrent_specialists} or fewer specialists.`,
            },
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
  config: CarAnalysisConfig,
  dataStream: StreamWriter,
  requestId: string,
  reportTitle: string,
): Promise<Pick<AgentState, 'final_report' | 'reportResult'>> {
  const notes = state.notes || [];

  const model = getLanguageModel(config.final_report_model as ModelId);
  const findings = notes.join('\n');

  const finalReportPromptText = finalReportGenerationPrompt({
    analysis_brief: state.analysis_brief || '',
    findings,
    date: getTodayStr(),
  });

  const finalReportUpdateId = generateUUID();
  dataStream.write({
    id: finalReportUpdateId,
    type: 'data-carAnalysisUpdate',
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
    type: 'data-carAnalysisUpdate',
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

// Main car analyst workflow
export async function runCarAnalyst(
  input: AnalysisInputState,
  config: CarAnalysisConfig,
  dataStream: StreamWriter,
): Promise<CarAnalysisResult> {
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
    type: 'data-carAnalysisUpdate',
    data: {
      title: 'Starting car analysis',
      type: 'started',
      timestamp: Date.now(),
    },
  });

  // Step 2: Write analysis brief
  const briefResult = await writeAnalysisBrief(
    { requestId: currentState.requestId, messages: currentState.inputMessages },
    config,
    dataStream,
  );
  currentState.analysis_brief = briefResult.analysis_brief;
  currentState.car_details = briefResult.car_details;
  const reportTitle = briefResult.title;

  // Step 3: Analysis supervisor loop
  const supervisorAgent = new SupervisorAgent(config, dataStream);

  const supervisorResult = await supervisorAgent.runSupervisorGraph({
    requestId: currentState.requestId,
    supervisor_messages: [
      {
        role: 'system' as const,
        content: supervisorSystemPrompt({
          date: getTodayStr(),
          max_concurrent_specialists: config.max_concurrent_specialists,
        }),
      },
      {
        role: 'user' as const,
        content: briefResult.analysis_brief,
      },
    ],
    analysis_brief: currentState.analysis_brief || '',
    car_details: currentState.car_details!,
    notes: currentState.notes,
    analysis_iterations: 0,
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
    type: 'data-carAnalysisUpdate',
    data: {
      title: 'Car analysis complete',
      type: 'completed',
      timestamp: Date.now(),
    },
  });

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