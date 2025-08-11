import { PreviewMessage } from './message';
import { memo } from 'react';
import type { Vote } from '@/lib/db/schema';
import type { UseChatHelpers } from '@ai-sdk/react';
import { ResponseErrorMessage } from './response-error-message';
import { ThinkingMessage } from './thinking-message';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStickToBottom } from 'use-stick-to-bottom';
import { Button } from './ui/button';
import { ArrowDown } from 'lucide-react';
import { Greeting } from './greeting';
import type { ChatMessage } from '@/lib/ai/types';
import {
  useChatId,
  useChatStatus,
  useMessageIds,
} from '@/lib/stores/chat-store';

interface PureMessagesInternalProps {
  votes: Array<Vote> | undefined;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  regenerate: (options?: any) => void;
  isReadonly: boolean;
}

const PureMessagesInternal = memo(function PureMessagesInternal({
  votes,
  sendMessage,
  regenerate,
  isReadonly,
}: PureMessagesInternalProps) {
  const chatId = useChatId();
  const status = useChatStatus();
  const messageIds = useMessageIds();

  // TODO: Verify if this is needed ai sdk v5
  // useDataStream();

  if (!chatId) {
    return null;
  }

  return (
    <>
      {messageIds.length === 0 && <Greeting />}

      {messageIds.map((messageId, index) => (
        <PreviewMessage
          key={messageId}
          messageId={messageId}
          isLoading={status === 'streaming' && messageIds.length - 1 === index}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === messageId)
              : undefined
          }
          parentMessageId={index > 0 ? messageIds[index - 1] : null}
          sendMessage={sendMessage}
          isReadonly={isReadonly}
        />
      ))}

      {status === 'submitted' && messageIds.length > 0 && (
        // messages[messages.length - 1].role === 'user' &&
        <ThinkingMessage />
      )}

      {status === 'error' && <ResponseErrorMessage regenerate={regenerate} />}

      <div className="shrink-0 min-w-[24px] min-h-[24px]" />
    </>
  );
});

export interface MessagesProps {
  votes: Array<Vote> | undefined;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  regenerate: (options?: any) => void;
  isReadonly: boolean;
  isVisible: boolean;
  onModelChange?: (modelId: string) => void;
}

function PureMessages({
  votes,
  sendMessage,
  regenerate,
  isReadonly,
  isVisible,
}: MessagesProps) {
  const { scrollRef, contentRef, scrollToBottom, isNearBottom, state } =
    useStickToBottom();

  return (
    <ScrollArea
      ref={scrollRef}
      className="flex flex-col flex-1 w-full"
      viewPortClassName=" [&>div]:!block"
    >
      <div
        ref={contentRef}
        className="flex flex-col px-2 sm:px-4 min-w-0 gap-6 pt-4 sm:max-w-2xl md:max-w-3xl container mx-auto h-full"
      >
        <PureMessagesInternal
          votes={votes}
          sendMessage={sendMessage}
          regenerate={regenerate}
          isReadonly={isReadonly}
        />
      </div>
      {/* Scroll to bottom button */}
      <div className="absolute bottom-4 flex justify-center items-center w-full">
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'rounded-full shadow-lg bg-background/80 hover:bg-muted z-10',
            isNearBottom && 'hidden',
          )}
          onClick={() => scrollToBottom()}
        >
          <ArrowDown className="size-4" />
        </Button>
      </div>
    </ScrollArea>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.votes !== nextProps.votes) return false;
  if (prevProps.isReadonly !== nextProps.isReadonly) return false;
  // NOTE: isVisible avoids re-renders when the messages aren't visible
  if (prevProps.isVisible !== nextProps.isVisible) return false;
  if (prevProps.sendMessage !== nextProps.sendMessage) return false;
  if (prevProps.regenerate !== nextProps.regenerate) return false;

  return true;
});
