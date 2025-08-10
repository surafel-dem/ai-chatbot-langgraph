import { systemPrompt } from '@/lib/ai/prompts';
import { getTools } from '@/lib/ai/tools/tools';
import { ChatMessage } from '@/lib/ai/types';
import { openai } from '@ai-sdk/openai';
import { readChat, saveChat } from '@util/chat-store';
import { convertToModelMessages, createUIMessageStream, generateId, JsonToSseTransformStream, stepCountIs, streamText } from 'ai';
import { after } from 'next/server';
import { createResumableStreamContext, type ResumableStreamContext } from 'resumable-stream';

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(req: Request) {
  const {
    message: prevMessages,
    id,
    trigger,
    messageId: userMessageId,
  }: {
    message: ChatMessage | undefined;
    id: string;
    trigger: 'submit-message' | 'regenerate-message';
    messageId: string | undefined;
  } = await req.json();

  const chat = await readChat(id);
  let currentMessages: ChatMessage[] = chat.messages;

  if (trigger === 'submit-message') {
    if (userMessageId != null) {
      const messageIndex = currentMessages.findIndex(m => m.id === userMessageId);

      if (messageIndex === -1) {
        throw new Error(`message ${userMessageId} not found`);
      }

      currentMessages = currentMessages.slice(0, messageIndex);
      currentMessages.push(prevMessages!);
    } else {
      currentMessages = [...currentMessages, prevMessages!];
    }
  } else if (trigger === 'regenerate-message') {
    const messageIndex =
    userMessageId == null
        ? currentMessages.length - 1
        : currentMessages.findIndex(message => message.id === userMessageId);

    if (messageIndex === -1) {
      throw new Error(`message ${userMessageId} not found`);
    }

    // set the messages to the message before the assistant message
    currentMessages = currentMessages.slice(
      0,
      currentMessages[messageIndex].role === 'assistant'
        ? messageIndex
        : messageIndex + 1,
    );
  }

const messageId = generateId();

  const streamId = generateId();


  // save the user message
  saveChat({ id, messages: currentMessages, activeStreamId: null });
  const stream = createUIMessageStream<ChatMessage>({
    execute: ({ writer: dataStream }) => {
  const result = streamText({
    model: openai('gpt-5-mini'),
    system: systemPrompt(),
    messages: convertToModelMessages(currentMessages),
    tools: getTools({
      dataStream,
      messageId,
      contextForLLM: convertToModelMessages(currentMessages),
    }),
    stopWhen: [
      stepCountIs(5),
      ({ steps }) => {
        return steps.some((step) => {
          const toolResults = step.content;

          // Don't stop if the tool result is a clarifying question
          return toolResults.some(
            (toolResult) =>
              toolResult.type === 'tool-result' &&
              toolResult.toolName === 'deepResearch' &&
              (toolResult.output as any).format === 'report',
          );
        });
      },
    ],
    });

    result.consumeStream();

  dataStream.merge(
    result.toUIMessageStream({
      sendReasoning: true,
    }))

    

  },
  onFinish: ({ messages }) => {
    console.log("onFinish assistant messages"); 
    console.dir(messages, { depth: null });
    saveChat({ id, messages: [...currentMessages, ...messages], activeStreamId: null });
  },
  generateId: () => messageId,

})
const streamContext = getStreamContext();

if (streamContext) {
  console.log('RESPONSE > POST /api/chat: Returning resumable stream');
  return new Response(
    await streamContext.resumableStream(streamId, () =>
      stream.pipeThrough(new JsonToSseTransformStream()),
    )
  );
} else {
  return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
}
  
}
