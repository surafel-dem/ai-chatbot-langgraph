'use client';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, getAttachmentsFromMessage } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import { Retrieve } from './retrieve';
import { StockChartMessage } from './stock-chart-message';
import { CodeInterpreterMessage } from './code-interpreter-message';
import { SourcesAnnotations, ResearchUpdates } from './message-annotations';
import { ReadDocument } from './read-document';
import { AttachmentList } from './attachment-list';
import { Skeleton } from './ui/skeleton';
import { ImageModal } from './image-modal';
import { GeneratedImage } from './generated-image';
import type { ChatMessage } from '@/lib/ai/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import { chatStore, useChatId, useMessageById } from '@/lib/stores/chat-store';

// Helper function to check if this is the last artifact
const isLastArtifact = (
  messages: any[],
  currentToolCallId: string,
): boolean => {
  let lastArtifact: {
    messageIndex: number;
    toolCallId: string;
  } | null = null;

  // This logic mirrors findLastArtifact from lib/utils
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'assistant') {
      for (const part of (message as any).parts) {
        if (
          (part.type === 'tool-createDocument' ||
            part.type === 'tool-updateDocument' ||
            part.type === 'tool-deepResearch') &&
          part.state === 'output-available'
        ) {
          lastArtifact = {
            messageIndex: i,
            toolCallId: part.toolCallId,
          };
          break;
        }
      }
      if (lastArtifact) break;
    }
  }

  return lastArtifact?.toolCallId === currentToolCallId;
};

// Collect research updates between a tool call input and its output
const collectResearchUpdates = (
  parts: ChatMessage['parts'],
  toolCallId: string,
  toolType: 'tool-deepResearch' | 'tool-webSearch',
) => {
  const startIdx = parts.findIndex(
    (p) => p.type === toolType && p.toolCallId === toolCallId,
  );

  if (startIdx === -1) return [];

  // End at the next tool call start (either deepResearch or webSearch)
  const endIdx = parts.findIndex(
    (p, i) =>
      i > startIdx &&
      (p.type === 'tool-deepResearch' || p.type === 'tool-webSearch'),
  );

  const sliceEnd = endIdx === -1 ? parts.length : endIdx;
  const updates = parts
    .slice(startIdx + 1, sliceEnd)
    .filter((p) => p.type === 'data-researchUpdate')
    .map((u: any) => u.data);
  return updates;
};

interface BaseMessageProps {
  messageId: string;
  vote: Vote | undefined;
  isLoading: boolean;
  isReadonly: boolean;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  parentMessageId: string | null;
}

const PureUserMessage = ({
  messageId,
  vote,
  isLoading,
  isReadonly,
  sendMessage,
  parentMessageId,
}: BaseMessageProps) => {
  const chatId = useChatId();
  const message = useMessageById(messageId);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    imageName?: string;
  }>({
    isOpen: false,
    imageUrl: '',
    imageName: undefined,
  });

  const handleImageClick = (imageUrl: string, imageName?: string) => {
    setImageModal({
      isOpen: true,
      imageUrl,
      imageName,
    });
  };

  const handleImageModalClose = () => {
    setImageModal({
      isOpen: false,
      imageUrl: '',
      imageName: undefined,
    });
  };

  if (!message) return null;
  const textPart = message.parts.find((part) => part.type === 'text');
  if (!textPart || !chatId) return null;

  return (
    <div
      className={cn(
        'w-full flex flex-col items-end',
        mode === 'edit'
          ? 'max-w-full'
          : 'group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:w-fit',
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-4 w-full',
          message.role === 'user' && mode !== 'edit' && 'items-end',
        )}
      >
        {mode === 'view' ? (
          !isReadonly ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-testid="message-content"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setMode('edit')}
                >
                  <div
                    data-testid="message-content"
                    className="flex flex-col gap-4 w-full bg-muted px-3 py-2 rounded-2xl border dark:border-zinc-700 text-left"
                  >
                    <AttachmentList
                      attachments={getAttachmentsFromMessage(message)}
                      onImageClick={handleImageClick}
                      testId="message-attachments"
                    />
                    <pre className="whitespace-pre-wrap font-sans">
                      {textPart.text}
                    </pre>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent>Click to edit message</TooltipContent>
            </Tooltip>
          ) : (
            <div
              data-testid="message-content"
              className="flex flex-col gap-4 w-full bg-muted px-3 py-2 rounded-2xl border dark:border-zinc-700 text-left"
            >
              <AttachmentList
                attachments={getAttachmentsFromMessage(message)}
                onImageClick={handleImageClick}
                testId="message-attachments"
              />
              <pre className="whitespace-pre-wrap font-sans">
                {textPart.text}
              </pre>
            </div>
          )
        ) : (
          <div className="flex flex-row gap-2 items-start">
            <MessageEditor
              key={message.id}
              chatId={chatId}
              message={message}
              setMode={setMode}
              sendMessage={sendMessage}
              parentMessageId={parentMessageId}
            />
          </div>
        )}

        <div className="self-end">
          <MessageActions
            key={`action-${message.id}`}
            chatId={chatId}
            messageId={message.id}
            role={message.role}
            vote={vote}
            isLoading={isLoading}
            isReadOnly={isReadonly}
            sendMessage={sendMessage}
          />
        </div>
      </div>
      <ImageModal
        isOpen={imageModal.isOpen}
        onClose={handleImageModalClose}
        imageUrl={imageModal.imageUrl}
        imageName={imageModal.imageName}
      />
    </div>
  );
};

const UserMessage = memo(PureUserMessage, (prevProps, nextProps) => {
  if (prevProps.messageId !== nextProps.messageId) return false;
  if (prevProps.isReadonly !== nextProps.isReadonly) return false;
  if (prevProps.sendMessage !== nextProps.sendMessage) return false;
  if (prevProps.parentMessageId !== nextProps.parentMessageId) return false;
  if (!equal(prevProps.vote, nextProps.vote)) return false;
  if (prevProps.isLoading !== nextProps.isLoading) return false;

  return true;
});

const PureAssistantMessage = ({
  messageId,
  vote,
  isLoading,
  isReadonly,
  sendMessage,
}: Omit<BaseMessageProps, 'parentMessageId'>) => {
  const chatId = useChatId();
  const message = useMessageById(messageId);

  if (!chatId || !message) return null;
  console.log(message.parts);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 w-full">
        {message.metadata?.isPartial && message.parts.length === 0 && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-4/5 rounded-full" />
            <Skeleton className="h-4 w-3/5 rounded-full" />
            <Skeleton className="h-4 w-2/5 rounded-full" />
          </div>
        )}

        {message.parts?.map((part, index) => {
          const { type } = part;
          const key = `message-${message.id}-part-${index}`;

          if (type === 'reasoning') {
            return (
              <MessageReasoning
                key={key}
                isLoading={isLoading}
                reasoning={part.text}
              />
            );
          }

          if (type === 'text') {
            return (
              <div key={key} className="flex flex-col gap-4 w-full">
                <Markdown>{part.text}</Markdown>
              </div>
            );
          }

          if (type === 'tool-getWeather') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              return (
                <div key={toolCallId} className="skeleton">
                  <Weather />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output } = part;
              return (
                <div key={toolCallId}>
                  <Weather weatherAtLocation={output} />
                </div>
              );
            }
          }

          if (type === 'tool-createDocument') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              const { input } = part;
              return (
                <div key={toolCallId}>
                  <DocumentPreview
                    isReadonly={isReadonly}
                    args={input}
                    messageId={message.id}
                  />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output, input } = part;
              const shouldShowFullPreview = isLastArtifact(
                chatStore.getState().messages,
                toolCallId,
              );

              if ('error' in output) {
                return (
                  <div
                    key={toolCallId}
                    className="text-red-500 p-2 border rounded"
                  >
                    Error: {String(output.error)}
                  </div>
                );
              }

              return (
                <div key={toolCallId}>
                  {shouldShowFullPreview ? (
                    <DocumentPreview
                      isReadonly={isReadonly}
                      result={output}
                      args={input}
                      messageId={message.id}
                      type="create"
                    />
                  ) : (
                    <DocumentToolResult
                      type="create"
                      result={output}
                      isReadonly={isReadonly}
                      messageId={message.id}
                    />
                  )}
                </div>
              );
            }
          }

          if (type === 'tool-updateDocument') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              const { input } = part;
              return (
                <div key={toolCallId}>
                  <DocumentToolCall
                    type="update"
                    // @ts-expect-error: // TODO: fix this
                    args={input}
                    isReadonly={isReadonly}
                  />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output, input } = part;
              const shouldShowFullPreview = isLastArtifact(
                chatStore.getState().messages,
                toolCallId,
              );

              if ('error' in output) {
                return (
                  <div
                    key={toolCallId}
                    className="text-red-500 p-2 border rounded"
                  >
                    Error: {String(output.error)}
                  </div>
                );
              }

              return (
                <div key={toolCallId}>
                  {shouldShowFullPreview ? (
                    <DocumentPreview
                      isReadonly={isReadonly}
                      result={output}
                      args={input}
                      messageId={message.id}
                      type="update"
                    />
                  ) : (
                    <DocumentToolResult
                      type="update"
                      result={output}
                      isReadonly={isReadonly}
                      messageId={message.id}
                    />
                  )}
                </div>
              );
            }
          }

          if (type === 'tool-requestSuggestions') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              const { input } = part;
              return (
                <div key={toolCallId}>
                  <DocumentToolCall
                    type="request-suggestions"
                    // @ts-expect-error: // TODO: fix this
                    args={input}
                    isReadonly={isReadonly}
                  />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output } = part;

              if ('error' in output) {
                return (
                  <div
                    key={toolCallId}
                    className="text-red-500 p-2 border rounded"
                  >
                    Error: {String(output.error)}
                  </div>
                );
              }

              return (
                <div key={toolCallId}>
                  <DocumentToolResult
                    type="request-suggestions"
                    result={output}
                    isReadonly={isReadonly}
                    messageId={message.id}
                  />
                </div>
              );
            }
          }

          if (type === 'tool-retrieve') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              return (
                <div key={toolCallId}>
                  <Retrieve />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output } = part;
              return (
                <div key={toolCallId}>
                  {/* @ts-expect-error: // TODO: fix this */}
                  <Retrieve result={output} />
                </div>
              );
            }
          }

          if (type === 'tool-readDocument') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              return null; // No loading state for readDocument
            }

            if (state === 'output-available') {
              const { output } = part;
              return (
                <div key={toolCallId}>
                  {/* @ts-expect-error: // TODO: fix this */}
                  <ReadDocument result={output} />
                </div>
              );
            }
          }

          if (type === 'tool-stockChart') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              const { input } = part;
              return (
                <div key={toolCallId}>
                  {/* @ts-expect-error: // TODO: fix this */}
                  <StockChartMessage result={null} args={input} />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output, input } = part;
              return (
                <div key={toolCallId}>
                  {/* @ts-expect-error: // TODO: fix this */}
                  <StockChartMessage result={output} args={input} />
                </div>
              );
            }
          }

          if (type === 'tool-codeInterpreter') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              const { input } = part;
              return (
                <div key={toolCallId}>
                  <CodeInterpreterMessage result={null} args={input} />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output, input } = part;
              return (
                <div key={toolCallId}>
                  {/* @ts-expect-error: // TODO: fix this */}
                  <CodeInterpreterMessage result={output} args={input} />
                </div>
              );
            }
          }

          if (type === 'tool-generateImage') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              const { input } = part;
              return (
                <div key={toolCallId}>
                  <GeneratedImage args={input} isLoading={true} />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output, input } = part;
              return (
                <div key={toolCallId}>
                  <GeneratedImage result={output} args={input} />
                </div>
              );
            }
          }

          if (type === 'tool-deepResearch') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              const updates = collectResearchUpdates(
                message.parts,
                toolCallId,
                'tool-deepResearch',
              );
              return (
                <div key={toolCallId} className="flex flex-col gap-3">
                  <ResearchUpdates updates={updates} />
                </div>
              );
            }

            if (state === 'output-available') {
              const { output, input } = part;
              const shouldShowFullPreview = isLastArtifact(
                chatStore.getState().messages,
                toolCallId,
              );
              const updates = collectResearchUpdates(
                message.parts,
                toolCallId,
                'tool-deepResearch',
              );

              if (output.format === 'report') {
                return (
                  <div key={toolCallId}>
                    <div className="mb-2">
                      <ResearchUpdates updates={updates} />
                    </div>
                    {shouldShowFullPreview ? (
                      <DocumentPreview
                        isReadonly={isReadonly}
                        result={output}
                        args={input}
                        messageId={message.id}
                        type="create"
                      />
                    ) : (
                      <DocumentToolResult
                        type="create"
                        result={output}
                        isReadonly={isReadonly}
                        messageId={message.id}
                      />
                    )}
                  </div>
                );
              }
            }
          }

          if (type === 'tool-webSearch') {
            const { toolCallId, state } = part;

            if (state === 'input-available') {
              const updates = collectResearchUpdates(
                message.parts,
                toolCallId,
                'tool-webSearch',
              );
              return (
                <div key={toolCallId} className="flex flex-col gap-3">
                  <ResearchUpdates updates={updates} />
                </div>
              );
            }

            if (state === 'output-available') {
              const updates = collectResearchUpdates(
                message.parts,
                toolCallId,
                'tool-webSearch',
              );
              return (
                <div key={toolCallId} className="flex flex-col gap-3">
                  <ResearchUpdates updates={updates} />
                </div>
              );
            }
          }
        })}

        <SourcesAnnotations
          parts={message.parts}
          key={`sources-annotations-${message.id}`}
        />

        <MessageActions
          key={`action-${message.id}`}
          chatId={chatId}
          messageId={message.id}
          role={message.role}
          vote={vote}
          isLoading={isLoading}
          isReadOnly={isReadonly}
          sendMessage={sendMessage}
        />
      </div>
    </div>
  );
};

const AssistantMessage = memo(PureAssistantMessage, (prevProps, nextProps) => {
  if (prevProps.messageId !== nextProps.messageId) return false;
  if (prevProps.vote !== nextProps.vote) return false;
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isReadonly !== nextProps.isReadonly) return false;
  if (prevProps.sendMessage !== nextProps.sendMessage) return false;

  return true;
});

const PurePreviewMessage = ({
  messageId,
  vote,
  isLoading,
  isReadonly,
  sendMessage,
  parentMessageId,
}: BaseMessageProps) => {
  const message = useMessageById(messageId);
  if (!message) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        {message.role === 'user' ? (
          <UserMessage
            messageId={messageId}
            vote={vote}
            isLoading={isLoading}
            isReadonly={isReadonly}
            sendMessage={sendMessage}
            parentMessageId={parentMessageId}
          />
        ) : (
          <AssistantMessage
            messageId={messageId}
            vote={vote}
            isLoading={isLoading}
            isReadonly={isReadonly}
            sendMessage={sendMessage}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.messageId !== nextProps.messageId) return false;
    if (prevProps.sendMessage !== nextProps.sendMessage) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.parentMessageId !== nextProps.parentMessageId) return false;

    return true;
  },
);
