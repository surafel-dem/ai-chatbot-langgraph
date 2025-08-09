'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteChat } from '@/hooks/chat-sync-hooks';
import { useChatId } from '@/providers/chat-id-provider';

interface DeleteDialogProps {
  deleteId: string | null;
  showDeleteDialog: boolean;
  setShowDeleteDialog: (show: boolean) => void;
}

export function DeleteDialog({
  deleteId,
  showDeleteDialog,
  setShowDeleteDialog,
}: DeleteDialogProps) {
  const { id: chatId, type, refreshChatID } = useChatId();
  const router = useRouter();
  const { deleteChat } = useDeleteChat();

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      await deleteChat(deleteId, {
        onSuccess: () => toast.success('Chat deleted successfully'),
        onError: () => toast.error('Failed to delete chat'),
      });
    } catch (error) {
      // Error already handled by onError callback
    }

    setShowDeleteDialog(false);

    if (deleteId === chatId && type === 'chat') {
      refreshChatID();
      router.push('/');
    }
  }, [
    type,
    deleteId,
    deleteChat,
    chatId,
    refreshChatID,
    router,
    setShowDeleteDialog,
  ]);

  return (
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your chat
            and remove it from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
