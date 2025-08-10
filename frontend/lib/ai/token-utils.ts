import type { ModelMessage } from 'ai';

// Simple token estimation (rough approximation: ~4 characters per token)
const CHARS_PER_TOKEN = 4;

// Calculate approximate tokens from messages
export function calculateMessagesTokens(messages: ModelMessage[]): number {
  let totalChars = 0;

  for (const message of messages) {
    // Count characters for role
    totalChars += message.role.length;

    // Count characters for content - handle both string and array formats
    if (typeof message.content === 'string') {
      totalChars += message.content.length;
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text' && 'text' in part) {
          totalChars += (part.text || '').length;
        }
        // Add overhead for other part types (image, tool results, etc.)
        else {
          totalChars += 200; // rough estimate for non-text content
        }
      }
    }

    // Add overhead for message structure
    totalChars += 20;
  }

  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

// Simple prompt trimming to fit within character limit
export function trimPrompt(
  prompt: string,
  maxTokens: number,
): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  
  if (prompt.length <= maxChars) {
    return prompt;
  }

  // Simple truncation - could be improved with better word boundary detection
  return prompt.substring(0, maxChars - 3) + '...';
}

// Truncate messages array to fit within token limit
export function truncateMessages(
  messages: ModelMessage[],
  maxTokens: number,
  preserveSystemMessage = true,
): ModelMessage[] {
  if (messages.length === 0) return messages;

  // Always preserve system message if requested
  const systemMessage =
    preserveSystemMessage && messages[0]?.role === 'system'
      ? messages[0]
      : null;
  const otherMessages = systemMessage ? messages.slice(1) : messages;

  // Calculate tokens for system message if it exists
  const systemTokens = systemMessage
    ? calculateMessagesTokens([systemMessage])
    : 0;
  const availableTokens = maxTokens - systemTokens;

  if (availableTokens <= 0) {
    // If system message itself exceeds limit, truncate it
    if (systemMessage && typeof systemMessage.content === 'string') {
      return [
        {
          ...systemMessage,
          content: trimPrompt(systemMessage.content, maxTokens),
        },
      ];
    }
    return systemMessage ? [systemMessage] : [];
  }

  // Start with all other messages and remove from the beginning until we fit
  const truncatedMessages = [...otherMessages];
  let currentTokens = calculateMessagesTokens(truncatedMessages);

  while (currentTokens > availableTokens && truncatedMessages.length > 0) {
    truncatedMessages.shift(); // Remove oldest message first
    currentTokens = calculateMessagesTokens(truncatedMessages);
  }

  // If we still don't fit and have messages, truncate the content of the last message
  if (currentTokens > availableTokens && truncatedMessages.length > 0) {
    const lastMessage = truncatedMessages[truncatedMessages.length - 1];
    if (typeof lastMessage.content === 'string') {
      const availableChars = availableTokens * CHARS_PER_TOKEN;
      const truncatedContent = trimPrompt(lastMessage.content, availableTokens);

      truncatedMessages[truncatedMessages.length - 1] = {
        ...lastMessage,
        content: truncatedContent,
      };
    }
  }

  return systemMessage
    ? [systemMessage, ...truncatedMessages]
    : truncatedMessages;
}