import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  streamText,
  stepCountIs,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  getChatById,
  saveChat,
  getUserById,
  saveMessage,
  updateMessage,
  getMessageById,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { getTools } from '@/lib/ai/tools/tools';
import { toolsDefinitions, allTools } from '@/lib/ai/tools/tools-definitions';
import type { ToolName, ChatMessage } from '@/lib/ai/types';
import type { NextRequest } from 'next/server';
import {
  filterAffordableTools,
  getBaseModelCostByModelId,
} from '@/lib/credits/credits-utils';
import { getLanguageModel, getModelProviderOptions } from '@/lib/ai/providers';
import type { CreditReservation } from '@/lib/credits/credit-reservation';
import { getModelDefinition, type ModelDefinition } from '@/lib/ai/all-models';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';

import { after } from 'next/server';
import {
  getAnonymousSession,
  createAnonymousSession,
  setAnonymousSession,
} from '@/lib/anonymous-session-server';
import type { AnonymousSession } from '@/lib/types/anonymous';
import { ANONYMOUS_LIMITS } from '@/lib/types/anonymous';
import { markdownJoinerTransform } from '@/lib/ai/markdown-joiner-transform';
import { checkAnonymousRateLimit, getClientIP } from '@/lib/utils/rate-limit';
import type { ModelId } from '@/lib/ai/model-id';
import { calculateMessagesTokens } from '@/lib/ai/token-utils';
import { ChatSDKError } from '@/lib/ai/errors';
import { addExplicitToolRequestToMessages } from './addExplicitToolRequestToMessages';
import { getRecentGeneratedImage } from './getRecentGeneratedImage';
import { getCreditReservation } from './getCreditReservation';
import { filterReasoningParts } from './filterReasoningParts';
import { getThreadUpToMessageId } from './getThreadUpToMessageId';

// Create shared Redis clients for resumable stream and cleanup
let redisPublisher: any = null;
let redisSubscriber: any = null;

if (process.env.REDIS_URL) {
  (async () => {
    const redis = await import('redis');
    redisPublisher = redis.createClient({ url: process.env.REDIS_URL });
    redisSubscriber = redis.createClient({ url: process.env.REDIS_URL });
    await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
  })();
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
        keyPrefix: 'sparka-ai:resumable-stream',
        ...(redisPublisher && redisSubscriber
          ? {
              publisher: redisPublisher,
              subscriber: redisSubscriber,
            }
          : {}),
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

export function getRedisSubscriber() {
  return redisSubscriber;
}

export function getRedisPublisher() {
  return redisPublisher;
}

export async function POST(request: NextRequest) {
  try {
    const {
      id: chatId,
      message: userMessage,
      prevMessages: anonymousPreviousMessages,
    }: {
      id: string;
      message: ChatMessage;
      prevMessages: ChatMessage[];
    } = await request.json();

    if (!userMessage) {
      console.log('RESPONSE > POST /api/chat: No user message found');
      return new Response('No user message found', { status: 400 });
    }

    // Extract selectedModel from user message metadata
    const selectedModelId = userMessage.metadata?.selectedModel as ModelId;

    if (!selectedModelId) {
      console.log(
        'RESPONSE > POST /api/chat: No selectedModel in user message metadata',
      );
      return new Response('No selectedModel in user message metadata', {
        status: 400,
      });
    }

    const session = await auth();

    const userId = session?.user?.id || null;
    const isAnonymous = userId === null;
    let anonymousSession: AnonymousSession | null = null;

    // Check for anonymous users

    if (userId) {
      // TODO: Consider if checking if user exists is really needed
      const user = await getUserById({ userId });
      if (!user) {
        console.log('RESPONSE > POST /api/chat: User not found');
        return new Response('User not found', { status: 404 });
      }
    } else {
      // Apply rate limiting for anonymous users
      const clientIP = getClientIP(request);
      const rateLimitResult = await checkAnonymousRateLimit(
        clientIP,
        redisPublisher,
      );

      if (!rateLimitResult.success) {
        console.log(
          `RESPONSE > POST /api/chat: Rate limit exceeded for IP ${clientIP}`,
        );
        return new Response(
          JSON.stringify({
            error: rateLimitResult.error,
            type: 'RATE_LIMIT_EXCEEDED',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...(rateLimitResult.headers || {}),
            },
          },
        );
      }

      anonymousSession = await getAnonymousSession();
      if (!anonymousSession) {
        anonymousSession = await createAnonymousSession();
      }

      // Check message limits
      if (anonymousSession.remainingCredits <= 0) {
        console.log(
          'RESPONSE > POST /api/chat: Anonymous message limit reached',
        );
        return new Response(
          JSON.stringify({
            error: `You've used all ${ANONYMOUS_LIMITS.CREDITS} free messages. Sign up to continue chatting with unlimited access!`,
            type: 'ANONYMOUS_LIMIT_EXCEEDED',
            maxMessages: ANONYMOUS_LIMITS.CREDITS,
            suggestion:
              'Create an account to get unlimited messages and access to more AI models',
          }),
          {
            status: 402,
            headers: {
              'Content-Type': 'application/json',
              ...(rateLimitResult.headers || {}),
            },
          },
        );
      }

      // Validate model for anonymous users
      if (!ANONYMOUS_LIMITS.AVAILABLE_MODELS.includes(selectedModelId as any)) {
        console.log(
          'RESPONSE > POST /api/chat: Model not available for anonymous users',
        );
        return new Response(
          JSON.stringify({
            error: 'Model not available for anonymous users',
            availableModels: ANONYMOUS_LIMITS.AVAILABLE_MODELS,
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              ...(rateLimitResult.headers || {}),
            },
          },
        );
      }
    }

    // Extract selectedTool from user message metadata
    const selectedTool = userMessage.metadata.selectedTool || null;
    console.log('RESPONSE > POST /api/chat: selectedTool', selectedTool);
    let modelDefinition: ModelDefinition;
    try {
      modelDefinition = getModelDefinition(selectedModelId);
    } catch (error) {
      console.log('RESPONSE > POST /api/chat: Model not found');
      return new Response('Model not found', { status: 404 });
    }
    // Skip database operations for anonymous users
    if (!isAnonymous) {
      const chat = await getChatById({ id: chatId });

      if (chat && chat.userId !== userId) {
        console.log(
          'RESPONSE > POST /api/chat: Unauthorized - chat ownership mismatch',
        );
        return new Response('Unauthorized', { status: 401 });
      }

      if (!chat) {
        const title = await generateTitleFromUserMessage({
          message: userMessage,
        });

        await saveChat({ id: chatId, userId, title });
      } else {
        if (chat.userId !== userId) {
          console.log(
            'RESPONSE > POST /api/chat: Unauthorized - chat ownership mismatch',
          );
          return new Response('Unauthorized', { status: 401 });
        }
      }

      const [exsistentMessage] = await getMessageById({ id: userMessage.id });

      if (exsistentMessage && exsistentMessage.chatId !== chatId) {
        console.log(
          'RESPONSE > POST /api/chat: Unauthorized - message chatId mismatch',
        );
        return new Response('Unauthorized', { status: 401 });
      }

      if (!exsistentMessage) {
        // If the message does not exist, save it
        await saveMessage({
          _message: {
            id: userMessage.id,
            chatId: chatId,
            role: userMessage.role,
            parts: userMessage.parts,
            attachments: [],
            createdAt: new Date(),
            annotations: [],
            isPartial: false,
            parentMessageId: userMessage.metadata?.parentMessageId || null,
            selectedModel: selectedModelId,
            selectedTool: selectedTool,
          },
        });
      }
    }

    let explicitlyRequestedTools: ToolName[] | null = null;
    if (selectedTool === 'deepResearch')
      explicitlyRequestedTools = ['deepResearch'];
    // else if (selectedTool === 'reason') explicitlyRequestedTool = 'reasonSearch';
    else if (selectedTool === 'webSearch')
      explicitlyRequestedTools = ['webSearch'];
    else if (selectedTool === 'generateImage')
      explicitlyRequestedTools = ['generateImage'];
    else if (selectedTool === 'createDocument')
      explicitlyRequestedTools = ['createDocument', 'updateDocument'];

    const baseModelCost = getBaseModelCostByModelId(selectedModelId);

    let reservation: CreditReservation | null = null;

    if (!isAnonymous) {
      const { reservation: res, error: creditError } =
        await getCreditReservation(userId, baseModelCost);

      if (creditError) {
        console.log(
          'RESPONSE > POST /api/chat: Credit reservation error:',
          creditError,
        );
        return new Response(creditError, {
          status: 402,
        });
      }

      reservation = res;
    } else if (anonymousSession) {
      // Increment message count and update session
      anonymousSession.remainingCredits -= baseModelCost;
      await setAnonymousSession(anonymousSession);
    }

    let activeTools: ToolName[] = filterAffordableTools(
      isAnonymous ? ANONYMOUS_LIMITS.AVAILABLE_TOOLS : allTools,
      isAnonymous
        ? ANONYMOUS_LIMITS.CREDITS
        : reservation
          ? reservation.budget - baseModelCost
          : 0,
    );

    // Disable all tools for models with unspecified features
    if (!modelDefinition.features) {
      activeTools = [];
    } else {
      // Let's not allow deepResearch if the model support reasoning (it's expensive and slow)
      if (
        modelDefinition.features.reasoning &&
        activeTools.some((tool: ToolName) => tool === 'deepResearch')
      ) {
        activeTools = activeTools.filter(
          (tool: ToolName) => tool !== 'deepResearch',
        );
      }
    }

    if (
      explicitlyRequestedTools &&
      explicitlyRequestedTools.length > 0 &&
      !activeTools.some((tool: ToolName) =>
        explicitlyRequestedTools.includes(tool),
      )
    ) {
      console.log(
        'RESPONSE > POST /api/chat: Insufficient budget for requested tool:',
        explicitlyRequestedTools,
      );
      return new Response(
        `Insufficient budget for requested tool: ${explicitlyRequestedTools}.`,
        {
          status: 402,
        },
      );
    } else if (
      explicitlyRequestedTools &&
      explicitlyRequestedTools.length > 0
    ) {
      console.log(
        'Setting explicitly requested tools',
        explicitlyRequestedTools,
      );
      activeTools = explicitlyRequestedTools;
    }

    // Validate input token limit (50k tokens for user message)
    const totalTokens = calculateMessagesTokens(
      convertToModelMessages([userMessage]),
    );
    const MAX_INPUT_TOKENS = 50_000;

    if (totalTokens > MAX_INPUT_TOKENS) {
      console.log(
        `RESPONSE > POST /api/chat: Token limit exceeded: ${totalTokens} > ${MAX_INPUT_TOKENS}`,
      );
      const error = new ChatSDKError(
        'input_too_long:chat',
        `Message too long: ${totalTokens} tokens (max: ${MAX_INPUT_TOKENS})`,
      );
      return error.toResponse();
    }

    const messageThreadToParent = isAnonymous
      ? anonymousPreviousMessages
      : await getThreadUpToMessageId(
          chatId,
          userMessage.metadata.parentMessageId,
        );

    const messages = [...messageThreadToParent, userMessage].slice(-5);

    // Process conversation history
    const lastGeneratedImage = getRecentGeneratedImage(messages);
    addExplicitToolRequestToMessages(
      messages,
      activeTools,
      explicitlyRequestedTools,
    );

    // Filter out reasoning parts to ensure compatibility between different models
    const messagesWithoutReasoning = filterReasoningParts(messages.slice(-5));

    // TODO: Do something smarter by truncating the context to a numer of tokens (maybe even based on setting)
    const contextForLLM = convertToModelMessages(messagesWithoutReasoning);
    console.dir(contextForLLM, { depth: null });
    // Extract the last generated image for use as reference (only from the immediately previous message)
    console.log('active tools', activeTools);

    // Create AbortController with 55s timeout for credit cleanup
    const abortController = new AbortController();
    const timeoutId = setTimeout(async () => {
      if (reservation) {
        await reservation.cleanup();
      }
      abortController.abort();
    }, 290000); // 290 seconds

    // Ensure cleanup on any unhandled errors
    try {
      const messageId = generateUUID();
      const streamId = generateUUID();

      // Record this new stream so we can resume later - use Redis for all users
      if (redisPublisher) {
        const keyPrefix = isAnonymous
          ? `sparka-ai:anonymous-stream:${chatId}:${streamId}`
          : `sparka-ai:stream:${chatId}:${streamId}`;

        await redisPublisher.setEx(
          keyPrefix,
          600, // 10 minutes TTL
          JSON.stringify({ chatId, streamId, createdAt: Date.now() }),
        );
      }

      if (!isAnonymous) {
        // Save placeholder assistant message immediately (needed for document creation)
        await saveMessage({
          _message: {
            id: messageId,
            chatId: chatId,
            role: 'assistant',
            parts: [], // Empty placeholder
            attachments: [],
            createdAt: new Date(),
            annotations: [],
            isPartial: true,
            parentMessageId: userMessage.id,
            selectedModel: selectedModelId,
            selectedTool: null,
          },
        });
      }

      // Build the data stream that will emit tokens
      const stream = createUIMessageStream<ChatMessage>({
        execute: ({ writer: dataStream }) => {
          const result = streamText({
            model: getLanguageModel(selectedModelId),
            system: systemPrompt(),
            messages: contextForLLM,
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

            activeTools: activeTools,
            experimental_transform: markdownJoinerTransform(),
            experimental_telemetry: {
              isEnabled: true,
              functionId: 'chat-response',
            },
            tools: getTools({
              dataStream,
              session: {
                user: {
                  id: userId || undefined,
                },
                expires: 'noop',
              },
              contextForLLM,
              messageId,
              selectedModel: selectedModelId,
              attachments: userMessage.parts.filter(
                (part) => part.type === 'file',
              ),
              lastGeneratedImage,
            }),
            onError: (error) => {
              console.error('streamText error', error);
            },
            abortSignal: abortController.signal, // Pass abort signal to streamText
            ...(modelDefinition.features?.fixedTemperature
              ? {
                  temperature: modelDefinition.features.fixedTemperature,
                }
              : {}),

            providerOptions: getModelProviderOptions(selectedModelId),
          });

          result.consumeStream();

          const initialMetadata = {
            createdAt: new Date(),
            parentMessageId: userMessage.id,
            isPartial: false,
            selectedModel: selectedModelId,
          };

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning: true,
              messageMetadata: ({ part }) => {
                // send custom information to the client on start:
                if (part.type === 'start') {
                  return initialMetadata;
                }

                // when the message is finished, send additional information:
                if (part.type === 'finish') {
                  return {
                    ...initialMetadata,
                    isPartial: false,
                  };
                }
              },
            }),
          );
        },
        generateId: () => messageId,
        onFinish: async ({ messages, isContinuation, responseMessage }) => {
          // Clear timeout since we finished successfully
          clearTimeout(timeoutId);

          if (userId) {
            const actualCost =
              baseModelCost +
              messages
                .flatMap((message) => message.parts)
                .reduce((acc, toolResult) => {
                  if (!toolResult.type.startsWith('tool-')) {
                    return acc;
                  }

                  const toolDef =
                    toolsDefinitions[
                      toolResult.type.replace('tool-', '') as ToolName
                    ];

                  if (!toolDef) {
                    return acc;
                  }

                  return acc + toolDef.cost;
                }, 0);
            const assistantMessage = responseMessage; // TODO: Fix this in ai sdk v5 - responseMessage is not a UIMessage
            try {
              // TODO: Validate if this is correct ai sdk v5
              const assistantMessage = messages.at(-1);

              if (!assistantMessage) {
                throw new Error('No assistant message found!');
              }

              if (!isAnonymous) {
                await updateMessage({
                  _message: {
                    id: assistantMessage.id,
                    chatId: chatId,
                    role: assistantMessage.role ?? '',
                    parts: assistantMessage.parts ?? [],

                    attachments: [],
                    createdAt: new Date(),
                    annotations: [],
                    isPartial: false,
                    parentMessageId: userMessage.id,
                    selectedModel: selectedModelId,
                    selectedTool: null,
                  },
                });
              }

              // Finalize credit usage: deduct actual cost, release reservation
              if (reservation) {
                await reservation.finalize(actualCost);
              }
            } catch (error) {
              console.error('Failed to save chat or finalize credits:', error);
              // Still release the reservation on error
              if (reservation) {
                await reservation.cleanup();
              }
            }
          }
        },

        onError: (error) => {
          // Clear timeout on error
          clearTimeout(timeoutId);
          console.error('onError', error);
          // Release reserved credits on error (fire and forget)
          if (reservation) {
            reservation.cleanup();
          }
          if (anonymousSession) {
            anonymousSession.remainingCredits += baseModelCost;
            setAnonymousSession(anonymousSession);
          }
          return 'Oops, an error occured!';
        },
      });

      after(async () => {
        // Cleanup to happen after the POST response is sent
        // Set TTL on Redis keys to auto-expire after 10 minutes
        if (redisPublisher) {
          try {
            const keyPattern = `sparka-ai:resumable-stream:rs:sentinel:${streamId}*`;
            const keys = await redisPublisher.keys(keyPattern);
            if (keys.length > 0) {
              // Set 5 minute expiration on all stream-related keys
              await Promise.all(
                keys.map((key: string) => redisPublisher.expire(key, 300)),
              );
            }
          } catch (error) {
            console.error('Failed to set TTL on stream keys:', error);
          }
        }

        try {
          // Clean up stream info from Redis for all users
          if (redisPublisher) {
            const keyPrefix = isAnonymous
              ? `sparka-ai:anonymous-stream:${chatId}:${streamId}`
              : `sparka-ai:stream:${chatId}:${streamId}`;

            await redisPublisher.expire(keyPrefix, 300);
          }
        } catch (cleanupError) {
          console.error('Failed to cleanup stream record:', cleanupError);
        }
      });

      const streamContext = getStreamContext();

      if (streamContext) {
        console.log('RESPONSE > POST /api/chat: Returning resumable stream');
        return new Response(
          await streamContext.resumableStream(streamId, () =>
            stream.pipeThrough(new JsonToSseTransformStream()),
          ),
        );
      } else {
        return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('error found in try block', error);
      if (reservation) {
        await reservation.cleanup();
      }
      if (anonymousSession) {
        anonymousSession.remainingCredits += baseModelCost;
        setAnonymousSession(anonymousSession);
      }
      throw error;
    }
  } catch (error) {
    console.error('RESPONSE > POST /api/chat error:', error);
    return new Response('An error occurred while processing your request!', {
      status: 404,
    });
  }
}

// DELETE moved to tRPC chat.deleteChat mutation
