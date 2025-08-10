import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { withOptionalAuth, withAuth } from '@/lib/api-handler';
import { featureFlags } from '@/lib/feature-flags';
import { getAnonymousSession, setAnonymousSession, createAnonymousSession } from '@/lib/anonymous-session-server';
import { ANONYMOUS_LIMITS } from '@/lib/constants';
import { cookies } from 'next/headers';
import { ApiResponse } from '@/lib/api-response';
import { api } from "@/convex/_generated/api";
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { runOrchestrator } from '@/lib/ai/orchestrator';
import { postRequestBodySchema } from './schema';
import { systemPrompt, type RequestHints } from '@/lib/ai/prompts';
import type { AuthSession, UserType } from '@/lib/auth';
import { getBaseModelCost, getMaxToolCost, TOOL_CREDIT_COSTS } from '@/lib/ai/tool-costs';

export const maxDuration = 60;

export const POST = withOptionalAuth(async ({ convex, userId, request }) => {
  // Parse and validate request
  let requestBody;
  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    return ApiResponse.error('Invalid request body');
  }

  const {
    id,
    message,
    selectedChatModel,
    selectedVisibilityType,
  } = requestBody;

  // Determine user type and create/get user
  const userType: UserType = userId ? 'regular' : 'guest';
  let convexUserId;
  let guestId: string | null = null;
  
  const cookieStore = await cookies();
  const existingGuestId = cookieStore.get('guest_id')?.value || null;

  if (userId) {
    // Authenticated user
    convexUserId = await convex.mutation(api.users.ensureUser, {});
  } else {
    // Guest user
    guestId = existingGuestId ?? crypto.randomUUID();
    convexUserId = await convex.mutation(api.users.createGuestUser, { guest_id: guestId });
    if (!existingGuestId) {
      cookieStore.set('guest_id', guestId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }
  }

  // --- Optional credits gating (behind feature flag) ---
  if (featureFlags.credits) {
    if (userId) {
      // Reserved credits flow for registered users happens around streaming (future step)
    } else {
      // Anonymous: initialize or read cookie session (read-only change for now)
      let anon = await getAnonymousSession();
      if (!anon) {
        anon = await createAnonymousSession();
        await setAnonymousSession(anon);
      }
      // No enforcement yet; only ensures cookie exists for UI banner
    }
  }

  // Create session for tools - always provide a session object
  const session: AuthSession = userId 
    ? { user: { id: userId, sessionId: null, type: 'regular' } }
    : { user: { id: guestId!, sessionId: null, type: 'guest' } };

  // Check message limits
  const user = await convex.query(api.users.getUserById, { user_id: convexUserId });
  if (user && user.message_count > entitlementsByUserType[userType].maxMessagesPerDay) {
    return ApiResponse.error('Daily message limit exceeded', 429);
  }

  // Get or create chat
  const chat = await convex.query(api.chats.getChatById, { chat_id: id });
  
  if (!chat) {
    const title = await generateTitleFromUserMessage({ message });
    await convex.mutation(api.chats.createChat, {
      id,
      user_id: convexUserId,
      title,
      visibility: selectedVisibilityType,
    });
  } else if (chat.user_id !== convexUserId) {
    return ApiResponse.forbidden();
  }

  // Get existing messages
  const messagesFromDb = await convex.query(api.chats.getChatMessagesById, { chat_id: id });
  const uiMessages = [...convertToUIMessages(messagesFromDb), message];

  // Default location hints (San Francisco)
  const requestHints: RequestHints = {
    longitude: -122.4194,
    latitude: 37.7749,
    city: 'San Francisco',
    country: 'United States',
  };

  // Extract message content from parts
  const messageContent = message.parts?.map(p => 'text' in p ? p.text : '').join('') || '';

  // Derive an explicit intent from the latest message to guide the router
  const intent: 'plan' | 'purchase_advice' | 'running_cost' | 'reliability' | undefined = (() => {
    const t = messageContent.toLowerCase();
    if (t.includes('[orchestrator]')) {
      if (/running cost|running costs|mpg|insurance|tax/.test(t)) return 'running_cost';
      if (/reliability|common issues|recalls?/.test(t)) return 'reliability';
      if (/purchase advice|should i buy|compare|vs\b/.test(t)) return 'purchase_advice';
      return 'plan';
    }
    return undefined;
  })();

  // Save user message
  await convex.mutation(api.chats.sendMessage, {
    ui_id: message.id,
    chat_id: id,
    content: messageContent,
    role: 'user',
    parts: message.parts,
  });

  // Optional credits handling (kept behind feature flag for safety)
  let reservedAmount = 0;
  const baseModelCost = getBaseModelCost(selectedChatModel);
  if (featureFlags.credits) {
    if (userId) {
      // For now, allow unlimited sends for registered users by skipping reservation.
      // You can enable reservation later when paid credits go live.
      reservedAmount = 0;
    } else {
      // Guests: decrement cookie credits by base cost upfront
      const anon = await getAnonymousSession();
      if (anon) {
        if ((anon.remainingCredits ?? 0) <= 0) {
          return ApiResponse.error('You have reached the free limit. Sign in to continue.', 402);
        }
        anon.remainingCredits = Math.max(0, (anon.remainingCredits ?? 0) - baseModelCost);
        await setAnonymousSession(anon);
      }
    }
  }

  // Create streaming response
  const streamId = generateUUID();
  await convex.mutation(api.chats.startStream, { stream_id: streamId, chat_id: id });

  const stream = createUIMessageStream({
    execute: async ({ writer: dataStream }) => {
      if (featureFlags.agentsOrchestrator) {
        // Orchestrated path
        const runId = await convex.mutation(api.runs.startRun, {
          chat_id: id,
          user_id: userId ?? guestId ?? '',
          // persist last known planner-state if already computed (optional enhancement)
          planner_state: undefined,
        });

        try {
          const ac = new AbortController();
          await runOrchestrator({
            ui: dataStream,
            messages: convertToModelMessages(uiMessages),
            chatId: id,
            runId,
            userId: userId ?? guestId ?? '',
            convex,
            selectedChatModel,
            requestHints,
            userType,
            signal: ac.signal,
            intent,
          });
        } finally {
          await convex.mutation(api.runs.endRun, { run_id: runId });
          dataStream.done();
        }
      } else {
        // Existing chat-only path (kept intact)
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({ session, dataStream }),
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      }
    },
    generateId: generateUUID,
    onFinish: async ({ messages }) => {
      try {
        for (const message of messages) {
          const content = message.parts?.map(p => 'text' in p ? p.text : '').join('') || '';
          await convex.mutation(api.chats.sendMessage, {
            ui_id: message.id,
            chat_id: id,
            content,
            role: message.role as 'user' | 'assistant' | 'system',
            parts: message.parts,
          });
        }
        
        await convex.mutation(api.chats.completeStream, {
          stream_id: streamId,
        });

        // Finalize credits (registered users only; currently disabled)
        if (false && featureFlags.credits && userId) {
          const toolCost = messages
            .flatMap((m) => m.parts || [])
            .reduce((sum, part: any) => {
              // Our tools emit UI data; conservatively add cost when tool types are used
              if (part.type === 'tool-result' && part.toolName && TOOL_CREDIT_COSTS[part.toolName as keyof typeof TOOL_CREDIT_COSTS]) {
                return sum + TOOL_CREDIT_COSTS[part.toolName as keyof typeof TOOL_CREDIT_COSTS];
              }
              return sum;
            }, 0);
          const actual = baseModelCost + toolCost;
          await convex.mutation(api.credits.finalizeCreditsUsage, {
            user_id: convexUserId,
            reservedAmount,
            actualAmount: actual,
          });
        }
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    },
    onError: async () => {
      // Release credits on error
      if (featureFlags.credits) {
        if (userId && reservedAmount > 0) {
          await convex.mutation(api.credits.releaseReservedCredits, {
            user_id: convexUserId,
            amount: reservedAmount,
          });
        } else {
          const anon = await getAnonymousSession();
          if (anon) {
            anon.remainingCredits += baseModelCost;
            await setAnonymousSession(anon);
          }
        }
      }
      return 'An error occurred while processing your request.';
    },
  });

  return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
});

export const DELETE = withAuth(async ({ convex, userId, request }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiResponse.error('Chat ID is required');
  }

  // Get user and verify ownership
  const user = await convex.query(api.users.getCurrentUser, {});
  if (!user) {
    return ApiResponse.notFound('User');
  }

  const chat = await convex.query(api.chats.getChatById, { chat_id: id });
  if (!chat) {
    return ApiResponse.notFound('Chat');
  }

  if (chat.user_id !== user._id) {
    return ApiResponse.forbidden();
  }

  await convex.mutation(api.chats.deleteChat, { chat_id: id });
  
  return ApiResponse.success('Chat deleted successfully');
});
