import type { DeepResearchConfig, SearchAPI } from './configuration';
import type { ModelMessage, ToolModelMessage } from 'ai';
import { experimental_createMCPClient } from 'ai';

import type { ModelId } from '@/lib/ai/model-id';
import type { StreamWriter } from '@/lib/ai/types';
import { firecrawlWebSearch, tavilyWebSearch } from '../web-search';

// MCP Utils

type McpClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;
type McpToolSet = Awaited<ReturnType<McpClient['tools']>>;

export async function loadMcpTools(
  config: DeepResearchConfig,
  existingToolNames: Set<string>,
): Promise<McpToolSet> {
  if (!config.mcp_config?.url) {
    return {};
  }

  let client: McpClient | null = null;
  try {
    // Create MCP client based on configuration
    // Currently supports SSE transport only
    client = await experimental_createMCPClient({
      transport: {
        type: 'sse',
        url: config.mcp_config.url,
      },
    });

    // Get all available tools from the MCP server
    const tools = await client.tools();

    // Filter tools based on configuration and existing tools
    const filteredTools: McpToolSet = {};

    for (const [toolName, tool] of Object.entries(tools)) {
      // Skip if tool already exists
      if (existingToolNames.has(toolName)) {
        console.log(
          `Skipping tool ${toolName} because a tool with that name already exists`,
        );
        continue;
      }

      // If specific tools are configured, only include those
      if (config.mcp_config.tools && config.mcp_config.tools.length > 0) {
        if (!config.mcp_config.tools.includes(toolName)) {
          console.log(
            `Skipping tool ${toolName} because it's not in the config`,
          );
          continue;
        }
      }

      filteredTools[toolName] = tool;
    }

    return filteredTools;
  } catch (error) {
    console.error('Failed to load MCP tools:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return {};
  } finally {
    // Clean up the client connection
    if (client) {
      await client.close();
    }
  }
}

// Tool Utils

export function getSearchTool(
  searchApi: SearchAPI,
  config: DeepResearchConfig,
  dataStream: StreamWriter,
  id?: string,
) {
  if (searchApi === 'tavily') {
    return {
      webSearch: tavilyWebSearch({ dataStream, writeTopLevelUpdates: false }),
    };
  } else if (searchApi === 'firecrawl') {
    return {
      webSearch: firecrawlWebSearch({
        dataStream,
        writeTopLevelUpdates: false,
      }),
    };
  }
  throw new Error(`Unsupported search API: ${searchApi}`);
}

export async function getAllTools(
  config: DeepResearchConfig,
  dataStream: StreamWriter,
  id?: string,
): Promise<McpToolSet | (McpToolSet & { webSearch: ReturnType<typeof getSearchTool> })> {
  if (config.search_api === 'none') {
    const mcpTools = await loadMcpTools(config, new Set<string>());
    return mcpTools;
  }

  const searchTools = getSearchTool(config.search_api, config, dataStream, id);
  const existingToolNames = new Set<string>(Object.keys(searchTools));

  const mcpTools = await loadMcpTools(config, existingToolNames);

  // @ts-expect-error - TODO: fix this
  return { ...mcpTools, ...searchTools };
}

export function getNotesFromToolCalls(messages: ModelMessage[]): string[] {
  return (
    messages
      .filter<ToolModelMessage>((message) => message.role === 'tool')
      // TODO: This might need to be improved to get the output of the tool call parts
      .map((message) => JSON.stringify(message.content))
  );
}



const modelDefinitions: {id: ModelId, object: string, owned_by: string, name: string, description: string, context_window: number, max_tokens: number, pricing: {input: string, output: string}}[] = [
  {
    id: 'gpt-5',
    object: 'model',
    owned_by: 'openai',
    name: 'GPT-5',
    description:
      "GPT-5 is OpenAI's flagship language model that excels at complex reasoning, broad real-world knowledge, code-intensive, and multi-step agentic tasks.",
    context_window: 400000,
    max_tokens: 128000,
    pricing: {
      input: '0.00000125',
      output: '0.00001',
    },
  },
  {
    id: 'gpt-5-mini',
    object: 'model',
    owned_by: 'openai',
    name: 'GPT-5 mini',
    description:
      'GPT-5 mini is a cost optimized model that excels at reasoning/chat tasks. It offers an optimal balance between speed, cost, and capability.',
    context_window: 400000,
    max_tokens: 128000,
    pricing: {
      input: '0.00000025',
      output: '0.000002',
    },
  },
  {
    id: 'gpt-5-nano',
    object: 'model',
    owned_by: 'openai',
    name: 'GPT-5 nano',
    description:
      'GPT-5 nano is a high throughput model that excels at simple instruction or classification tasks.',
    context_window: 400000,
    max_tokens: 128000,
    pricing: {
      input: '0.00000005',
      output: '0.0000004',
    },
  },
    {
      id: 'gpt-4o',
      object: 'model',
      owned_by: 'openai',
      name: 'GPT-4o',
      description:
        'GPT-4o from OpenAI has broad general knowledge and domain expertise allowing it to follow complex instructions in natural language and solve difficult problems accurately. It matches GPT-4 Turbo performance with a faster and cheaper API.',
      context_window: 128000,
      max_tokens: 1024,
      pricing: {
        input: '0.0000025',
        output: '0.00001',
      },
    },
    {
      id: 'gpt-4o-mini',
      object: 'model',
      owned_by: 'openai',
      name: 'GPT-4o mini',
      description:
        'GPT-4o mini from OpenAI is their most advanced and cost-efficient small model. It is multi-modal (accepting text or image inputs and outputting text) and has higher intelligence than gpt-3.5-turbo but is just as fast.',
      context_window: 128000,
      max_tokens: 1024,
      pricing: {
        input: '0.00000015',
        output: '0.0000006',
      },
    }, 
  ]
  
export function getModelContextWindow(modelId: ModelId): number {
  const model = modelDefinitions.find((model) => model.id === modelId);
  if (!model) throw new Error(`Model not found: ${modelId}`);
  return model.context_window;
}

// Misc Utils
export function getTodayStr(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
