'use client';
import { useQuery } from '@tanstack/react-query';
import { ChatHeader } from '@/components/chat-header';
import { cn, generateUUID, fetchWithErrorHandlers } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { useTRPC } from '@/trpc/react';
import { useSession } from 'next-auth/react';

import { useSidebar } from '@/components/ui/sidebar';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useSaveMessageMutation } from '@/hooks/chat-sync-hooks';
import { CloneChatButton } from '@/components/clone-chat-button';
import type { ChatMessage } from '@/lib/ai/types';
import { useDataStream } from './data-stream-provider';
import { ZustandChat, chatState, chatStore } from '@/lib/stores/chat-store';
import { useEffect, useMemo } from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';

function useRecreateChat(id: string, initialMessages: Array<ChatMessage>) {
  useEffect(() => {
    if (id !== chatStore.getState().id) {
      chatStore.getState().setNewChat(id, initialMessages || []);
    }
  }, [id, initialMessages]);
}

export function Chat({
  id,
  initialMessages,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<ChatMessage>;
  isReadonly: boolean;
}) {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const { mutate: saveChatMessage } = useSaveMessageMutation();

  const { setDataStream } = useDataStream();

  // Workaround to act as `shouldRecreateChat` functionality in the `useChat` hook
  // If the id is different from the stored id, reset the chat with new messages
  useRecreateChat(id, initialMessages);

  const isAuthenticated = !!session?.user;
  const isLoading = id !== chatStore.getState().id;

  const chat = useMemo(() => {
    console.log('renewing chat');
    return new ZustandChat<ChatMessage>({
      state: chatState,

      id,
      // messages: initialMessages,
      // sendExtraMessageFields: true,
      generateId: generateUUID,
      onFinish: ({ message }) => {
        console.log('onFinish message', message);
        saveChatMessage({
          message,
          chatId: id,
        });
      },
      transport: new DefaultChatTransport({
        api: '/api/chat',
        fetch: fetchWithErrorHandlers,
        prepareSendMessagesRequest({ messages, id, body }) {
          return {
            body: {
              id,
              message: messages.at(-1),
              prevMessages: isAuthenticated ? [] : messages.slice(0, -1),
              ...body,
            },
          };
        },
      }),
      onData: (dataPart) => {
        console.log('onData', dataPart);
        setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      },
      onError: (error) => {
        console.error(error);
        const cause = error.cause;
        if (cause && typeof cause === 'string') {
          toast.error(error.message ?? 'An error occured, please try again!', {
            description: cause,
          });
        } else {
          toast.error(error.message ?? 'An error occured, please try again!');
        }
      },
    });
  }, [id, saveChatMessage, setDataStream, isAuthenticated]);

  const { messages, status, stop, resumeStream, sendMessage, regenerate } =
    useChat<ChatMessage>({
      // @ts-expect-error #private property required but not really
      chat: chat,
      experimental_throttle: 100,
    });

  console.log('messages', messages);
  // Auto-resume functionality
  useAutoResume({
    autoResume: true,
    initialMessages: initialMessages,
    resumeStream,
  });

  const { data: votes } = useQuery({
    ...trpc.vote.getVotes.queryOptions({ chatId: id }),
    enabled:
      messages.length >= 2 && !isReadonly && !!session?.user && !isLoading,
  });

  const { state } = useSidebar();
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <>
      <div
        className={cn(
          '@container flex flex-col min-w-0 h-dvh bg-background md:max-w-[calc(100vw-var(--sidebar-width))] max-w-screen',
          state === 'collapsed' && 'md:max-w-screen',
        )}
      >
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          hasMessages={messages.length > 0}
          user={session?.user}
        />

        <Messages
          votes={votes}
          sendMessage={sendMessage}
          regenerate={regenerate}
          isReadonly={isReadonly}
          isVisible={!isArtifactVisible}
        />

        {!isReadonly ? (
          <MultimodalInput
            chatId={id}
            status={status}
            stop={stop}
            sendMessage={sendMessage}
            parentMessageId={chatStore.getState().getLastMessageId()}
          />
        ) : (
          <CloneChatButton chatId={id} className="w-full" />
        )}
      </div>

      <Artifact
        chatId={id}
        sendMessage={sendMessage}
        regenerate={regenerate}
        status={status}
        stop={stop}
        messages={messages}
        votes={votes}
        isReadonly={isReadonly}
        isAuthenticated={!!session?.user}
      />
    </>
  );
}
