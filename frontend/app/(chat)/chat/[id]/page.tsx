import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { Chat } from '@/components/chat';
import { api } from "@/convex/_generated/api";
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { convertToUIMessages } from '@/lib/utils';
import { createAuthenticatedClient, createGuestClient, getCurrentUserId } from '@/lib/convex-client';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  
  // Get current user ID from Clerk
  const userId = await getCurrentUserId();
  
  // For server-side queries, use guest client to read data, then check permissions
  const convex = createGuestClient();
  
  // Create auth session if user is logged in
  let authSession = null;
  if (userId) {
    authSession = { 
      user: { 
        id: userId, 
        sessionId: null, 
        type: 'regular' as const 
      } 
    };
  }
  
  // Get the chat
  const chat = await convex.query(api.chats.getChatById, { chat_id: id });
  
  if (!chat) {
    notFound();
  }

  // Check permissions
  if (chat.visibility === 'private') {
    if (!userId) {
      // Private chat requires authentication
      redirect('/login');
    }
    
    // For private chats, we need to verify ownership
    // Create authenticated client to get user details
    try {
      const authConvex = await createAuthenticatedClient();
      const convexUser = await authConvex.query(api.users.getCurrentUser, {});
      
      // Check ownership
      if (!convexUser || convexUser._id !== chat.user_id) {
        console.log('❌ Access denied: User does not own this private chat');
        return notFound();
      }
      
    } catch (error) {
      console.error('❌ Error checking user ownership:', error);
      return notFound();
    }
  }

  // Get messages
  const messagesFromDb = await convex.query(api.chats.getChatMessagesById, { 
    chat_id: id 
  });

  const uiMessages = convertToUIMessages(messagesFromDb || []);

  // Get chat model preference from cookies
  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');

  const chatModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

  // Don't auto-resume for historical chats (chats with existing messages)
  const shouldAutoResume = uiMessages.length === 0;

  return (
    <>
      <Chat
        id={id}
        initialMessages={uiMessages}
        initialChatModel={chatModel}
        initialVisibilityType={chat.visibility}
        isReadonly={false}
        session={authSession}
        autoResume={shouldAutoResume}
      />
      <DataStreamHandler />
    </>
  );
}