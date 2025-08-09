'use client';
import type { Attachment, ChatMessage } from '@/lib/ai/types';

import type React from 'react';
import { useRef, useState, useCallback, type ChangeEvent, memo } from 'react';
import { toast } from 'sonner';
import { useWindowSize } from 'usehooks-ts';
import { useDropzone } from 'react-dropzone';
import { motion } from 'motion/react';
import { useSession } from 'next-auth/react';
import {
  chatStore,
  useSetMessages,
  useMessageIds,
} from '@/lib/stores/chat-store';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { AttachmentList } from './attachment-list';
import { Button } from './ui/button';
import { ImageModal } from './image-modal';
import {
  ChatInputContainer,
  ChatInputTopRow,
  ChatInputTextArea,
  ChatInputBottomRow,
} from './ui/chat-input';
import { SuggestedActions } from './suggested-actions';
import type { UseChatHelpers } from '@ai-sdk/react';
import { useChatInput } from '@/providers/chat-input-provider';
import { ModelSelector } from './model-selector';
import { ResponsiveTools } from './chat-tools';
import { ScrollArea } from './ui/scroll-area';
import {
  getModelDefinition,
  DEFAULT_PDF_MODEL,
  DEFAULT_CHAT_IMAGE_COMPATIBLE_MODEL,
} from '@/lib/ai/all-models';
import { CreditLimitDisplay } from './upgrade-cta/credit-limit-display';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { LoginPrompt } from './upgrade-cta/login-prompt';
import { generateUUID } from '@/lib/utils';
import { useSaveMessageMutation } from '@/hooks/chat-sync-hooks';

function PureMultimodalInput({
  chatId,
  status,
  stop,
  sendMessage,
  className,
  isEditMode = false,
  parentMessageId,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  className?: string;
  isEditMode?: boolean;
  parentMessageId: string | null;
}) {
  const { width } = useWindowSize();
  const { data: session } = useSession();
  const { mutate: saveChatMessage } = useSaveMessageMutation();
  const setMessages = useSetMessages();
  const messageIds = useMessageIds();

  // Detect mobile devices
  const isMobile = width ? width <= 768 : false;
  const {
    editorRef,
    selectedTool,
    setSelectedTool,
    attachments,
    setAttachments,
    selectedModelId,
    handleModelChange,
    getInputValue,
    handleInputChange,
    getInitialInput,
    isEmpty,
    handleSubmit,
  } = useChatInput();

  // Helper function to auto-switch to PDF-compatible model
  const switchToPdfCompatibleModel = useCallback(() => {
    const defaultPdfModelDef = getModelDefinition(DEFAULT_PDF_MODEL);
    toast.success(`Switched to ${defaultPdfModelDef.name} (supports PDF)`);
    handleModelChange(DEFAULT_PDF_MODEL);
    return defaultPdfModelDef;
  }, [handleModelChange]);

  // Helper function to auto-switch to image-compatible model
  const switchToImageCompatibleModel = useCallback(() => {
    const defaultImageModelDef = getModelDefinition(
      DEFAULT_CHAT_IMAGE_COMPATIBLE_MODEL,
    );
    toast.success(`Switched to ${defaultImageModelDef.name} (supports images)`);
    handleModelChange(DEFAULT_CHAT_IMAGE_COMPATIBLE_MODEL);
    return defaultImageModelDef;
  }, [handleModelChange]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    imageName?: string;
  }>({
    isOpen: false,
    imageUrl: '',
    imageName: undefined,
  });

  // Helper function to process and validate files
  const processFiles = useCallback(
    (files: File[]) => {
      const imageFiles: File[] = [];
      const pdfFiles: File[] = [];
      const oversizedFiles: File[] = [];
      const unsupportedFiles: File[] = [];
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

      files.forEach((file) => {
        // Check file size first
        if (file.size > MAX_FILE_SIZE) {
          oversizedFiles.push(file);
          return;
        }

        // Then check file type
        if (file.type.startsWith('image/')) {
          imageFiles.push(file);
        } else if (file.type === 'application/pdf') {
          pdfFiles.push(file);
        } else {
          unsupportedFiles.push(file);
        }
      });

      // Show error messages for invalid files
      if (oversizedFiles.length > 0) {
        toast.error(`${oversizedFiles.length} file(s) exceed 5MB limit`);
      }
      if (unsupportedFiles.length > 0) {
        toast.error(
          `${unsupportedFiles.length} unsupported file type(s). Only images and PDFs are allowed`,
        );
      }

      // Auto-switch model based on file types
      if (pdfFiles.length > 0 || imageFiles.length > 0) {
        let currentModelDef = getModelDefinition(selectedModelId);

        // First check PDF support if PDFs are present
        if (pdfFiles.length > 0 && !currentModelDef.features?.input?.pdf) {
          currentModelDef = switchToPdfCompatibleModel();
        }

        // Then check image support if images are present (using potentially updated model)
        if (imageFiles.length > 0 && !currentModelDef.features?.input?.image) {
          currentModelDef = switchToImageCompatibleModel();
        }
      }

      return [...imageFiles, ...pdfFiles];
    },
    [selectedModelId, switchToPdfCompatibleModel, switchToImageCompatibleModel],
  );

  const coreSubmitLogic = useCallback(() => {
    const input = getInputValue();
    // For new chats, we need to update the url to include the chatId
    if (window.location.pathname === '/') {
      window.history.pushState({}, '', `/chat/${chatId}`);
    }

    // Get the appropriate parent message ID
    const effectiveParentMessageId = isEditMode
      ? parentMessageId
      : chatStore.getState().getLastMessageId();

    // In edit mode, trim messages to the parent message
    if (isEditMode) {
      if (parentMessageId === null) {
        // If no parent, clear all messages
        setMessages([]);
      } else {
        // Find the parent message and trim to that point
        const currentMessages = chatStore.getState().messages;
        const parentIndex = currentMessages.findIndex(
          (msg) => msg.id === parentMessageId,
        );
        if (parentIndex !== -1) {
          // Keep messages up to and including the parent
          const messagesUpToParent = currentMessages.slice(0, parentIndex + 1);
          setMessages(messagesUpToParent);
        }
      }
    }

    const message: ChatMessage = {
      id: generateUUID(),
      parts: [
        ...attachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: 'text',
          text: input,
        },
      ],
      metadata: {
        createdAt: new Date(),
        parentMessageId: effectiveParentMessageId,
        selectedModel: selectedModelId,
        selectedTool: selectedTool || undefined,
      },
      role: 'user',
    };

    saveChatMessage({
      message,
      chatId,
    });

    sendMessage(message);

    // Refocus after submit
    if (width && width > 768) {
      editorRef.current?.focus();
    }
  }, [
    attachments,
    sendMessage,
    width,
    chatId,
    selectedTool,
    isEditMode,
    getInputValue,
    saveChatMessage,
    parentMessageId,
    selectedModelId,
    setMessages,
    editorRef,
  ]);

  const submitForm = useCallback(() => {
    handleSubmit(coreSubmitLogic, isEditMode);
  }, [handleSubmit, coreSubmitLogic, isEditMode]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const validFiles = processFiles(files);

      if (validFiles.length === 0) return;

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, processFiles],
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      if (status !== 'ready') return;

      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      const files = Array.from(clipboardData.files);
      if (files.length === 0) return;

      event.preventDefault();

      // Check if user is anonymous
      if (!session?.user) {
        toast.error('Sign in to attach files from clipboard');
        return;
      }

      const validFiles = processFiles(files);
      if (validFiles.length === 0) return;

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);

        toast.success(
          `${successfullyUploadedAttachments.length} file(s) pasted from clipboard`,
        );
      } catch (error) {
        console.error('Error uploading pasted files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, processFiles, status, session],
  );

  const removeAttachment = useCallback(
    (attachmentToRemove: Attachment) => {
      setAttachments((currentAttachments) =>
        currentAttachments.filter(
          (attachment) => attachment.url !== attachmentToRemove.url,
        ),
      );
    },
    [setAttachments],
  );

  const handleImageClick = useCallback(
    (imageUrl: string, imageName?: string) => {
      setImageModal({
        isOpen: true,
        imageUrl,
        imageName,
      });
    },
    [],
  );

  const handleImageModalClose = useCallback(() => {
    setImageModal({
      isOpen: false,
      imageUrl: '',
      imageName: undefined,
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      // Check if user is anonymous
      if (!session?.user) {
        toast.error('Sign in to attach files');
        return;
      }

      const validFiles = processFiles(acceptedFiles);
      if (validFiles.length === 0) return;

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    noClick: true, // Prevent click to open file dialog since we have the button
    disabled: status !== 'ready',
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
    },
  });

  return (
    <div className="relative flex flex-col w-full gap-4 mx-auto p-2 @[400px]:px-4 @[400px]:pb-4 @[400px]:md:pb-6 bg-background md:max-w-3xl">
      {messageIds.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 &&
        !isEditMode && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            selectedModelId={selectedModelId}
          />
        )}

      {!isEditMode && <CreditLimitDisplay />}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        accept="image/*,.pdf"
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <div className="relative">
        <ChatInputContainer
          className={`${className} transition-colors px-1.5 @container  @[400px]:px-3  ${
            isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''
          }`}
          {...getRootProps()}
        >
          <input {...getInputProps()} />

          {isDragActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 dark:bg-blue-950/40 border-2 border-dashed border-blue-500 rounded-2xl z-10">
              <div className="text-blue-600 dark:text-blue-400 font-medium">
                Drop images or PDFs here to attach
              </div>
            </div>
          )}

          <motion.div
            animate={{
              height:
                attachments.length > 0 || uploadQueue.length > 0 ? 'auto' : 0,
              opacity: attachments.length > 0 || uploadQueue.length > 0 ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <ChatInputTopRow>
              {(attachments.length > 0 || uploadQueue.length > 0) && (
                <AttachmentList
                  attachments={attachments}
                  uploadQueue={uploadQueue}
                  onRemove={removeAttachment}
                  onImageClick={handleImageClick}
                  testId="attachments-preview"
                  className="px-3 py-2"
                />
              )}
            </ChatInputTopRow>
          </motion.div>

          <ScrollArea className="max-h-[50vh]">
            <ChatInputTextArea
              data-testid="multimodal-input"
              ref={editorRef}
              className="min-h-[80px]"
              placeholder={
                isMobile
                  ? 'Send a message... (Ctrl+Enter to send)'
                  : 'Send a message...'
              }
              initialValue={getInitialInput()}
              onInputChange={handleInputChange}
              autoFocus
              onPaste={handlePaste}
              onEnterSubmit={(event) => {
                // Different key combinations for mobile vs desktop
                const shouldSubmit = isMobile
                  ? event.ctrlKey && !event.isComposing
                  : !event.shiftKey && !event.isComposing;

                if (shouldSubmit) {
                  if (status !== 'ready' && status !== 'error') {
                    toast.error(
                      'Please wait for the model to finish its response!',
                    );
                  } else if (uploadQueue.length > 0) {
                    toast.error('Please wait for files to finish uploading!');
                  } else if (isEmpty) {
                    toast.error('Please enter a message before sending!');
                  } else {
                    submitForm();
                  }
                  return true; // Prevent default Enter behavior
                }

                return false; // Allow default behavior (e.g., Shift+Enter for new line)
              }}
            />
          </ScrollArea>

          <ChatInputBottomRow className="flex flex-row justify-between min-w-0 w-full">
            <div className="flex items-center gap-1 @[400px]:gap-2 min-w-0 flex-0">
              <ModelSelector
                selectedModelId={selectedModelId}
                className="h-fit text-xs @[400px]:text-sm min-w-0 shrink max-w-none px-2 @[400px]:px-3 py-1 @[400px]:py-1.5 truncate flex-1"
                onModelChange={handleModelChange}
              />
              <ResponsiveTools
                tools={selectedTool}
                setTools={setSelectedTool}
                selectedModelId={selectedModelId}
              />
            </div>
            <div className="flex gap-2">
              <AttachmentsButton fileInputRef={fileInputRef} status={status} />
              {status !== 'ready' ? (
                <StopButton stop={stop} />
              ) : (
                <SendButton
                  isEmpty={isEmpty}
                  submitForm={submitForm}
                  uploadQueue={uploadQueue}
                />
              )}
            </div>
          </ChatInputBottomRow>
        </ChatInputContainer>
      </div>

      <ImageModal
        isOpen={imageModal.isOpen}
        onClose={handleImageModalClose}
        imageUrl={imageModal.imageUrl}
        imageName={imageModal.imageName}
      />
    </div>
  );
}

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>['status'];
}) {
  const { data: session } = useSession();
  const isAnonymous = !session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isAnonymous) {
      setShowLoginPopover(true);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <Popover open={showLoginPopover} onOpenChange={setShowLoginPopover}>
      <PopoverTrigger asChild>
        <Button
          data-testid="attachments-button"
          className="p-1.5 h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
          onClick={handleClick}
          disabled={status !== 'ready'}
          variant="ghost"
        >
          <PaperclipIcon size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <LoginPrompt
          title="Sign in to attach files"
          description="You can attach images and PDFs to your messages for the AI to analyze."
        />
      </PopoverContent>
    </Popover>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
}: {
  stop: () => void;
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        // No need to call setMessages here as we're just stopping
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  isEmpty,
  uploadQueue,
}: {
  submitForm: () => void;
  isEmpty: boolean;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={isEmpty || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.isEmpty !== nextProps.isEmpty) return false;
  if (prevProps.submitForm !== nextProps.submitForm) return false;
  return true;
});

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    // More specific equality checks to prevent unnecessary re-renders
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.isEditMode !== nextProps.isEditMode) return false;
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.className !== nextProps.className) return false;

    return true;
  },
);
