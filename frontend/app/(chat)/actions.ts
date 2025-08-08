'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getAuthUser } from '@/lib/auth';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel('title-model'), // Use the dedicated title model
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  
  // For now, just delete the specific message since we don't have timestamp-based deletion in Convex
  await convex.mutation(api.chats.deleteMessage, { message_id: id as any });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const user = await getAuthUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  // For now, we'll just update the chat title as a placeholder
  // TODO: Add visibility field to Convex chat schema
  const chat = await convex.query(api.chats.getChat, { chat_id: chatId as any });
  if (chat) {
    await convex.mutation(api.chats.updateChatTitle, {
      chat_id: chatId as any,
      title: chat.title,
    });
  }
}
