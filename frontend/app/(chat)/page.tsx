import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { getCurrentUserId } from '@/lib/convex-client';

export default async function Page() {
  // Get current user ID from Clerk
  const userId = await getCurrentUserId();
  
  // Create session object for authenticated users
  const authSession = userId 
    ? { 
        user: { 
          id: userId, 
          sessionId: null, 
          type: 'regular' as const 
        } 
      }
    : null;

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');
  const chatModel = modelIdFromCookie?.value || DEFAULT_CHAT_MODEL;

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={chatModel}
        initialVisibilityType="private"
        isReadonly={false}
        session={authSession}
        autoResume={false}
      />
      <DataStreamHandler />
    </>
  );
}