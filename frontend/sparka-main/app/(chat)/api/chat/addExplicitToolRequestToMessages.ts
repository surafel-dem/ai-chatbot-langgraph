import type { ChatMessage, ToolName } from '@/lib/ai/types';

export function addExplicitToolRequestToMessages(
  messages: ChatMessage[],
  activeTools: ToolName[],
  explicitlyRequestedTools: ToolName[] | null,
) {
  const lastAssistantMessage = messages.findLast(
    (message) => message.role === 'assistant',
  );

  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return;
  }
  let toolsToRequest: ToolName[] = [];

  if (explicitlyRequestedTools) {
    // 1. Explicitly requested tools
    console.log(
      'Indicating explicitly requested tools',
      explicitlyRequestedTools,
    );
    toolsToRequest = explicitlyRequestedTools;
  } else if (
    lastAssistantMessage?.parts &&
    lastAssistantMessage.parts.length > 0
  ) {
    // 2. Unfinished deep research if it's unfinished
    for (const part of lastAssistantMessage.parts) {
      if (part.type === 'tool-deepResearch') {
        if (
          part.state === 'output-available' &&
          part.output.format === 'clarifying_questions'
        ) {
          toolsToRequest = ['deepResearch'];
          break; // Found it, no need to continue looping
        }
      }
    }
  }

  if (toolsToRequest.length > 0) {
    if (lastMessage) {
      lastMessage.parts.push({
        type: 'text',
        text: `I want to use the tools ${toolsToRequest.join(', or ')})`,
      });
    }
  }
}
