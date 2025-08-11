import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import { Suspense } from 'react';
import { WithSkeleton } from '@/components/ui/skeleton';
import { DeferredChatPage } from './deferred-chat-page';

export default async function ChatPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: chatId } = await params;

  // Prefetch the queries used in chat-page.tsx
  prefetch(trpc.chat.getChatById.queryOptions({ chatId }));
  prefetch(trpc.chat.getChatMessages.queryOptions({ chatId }));

  return (
    <HydrateClient>
      <Suspense
        fallback={
          <WithSkeleton isLoading={true} className="w-full h-full">
            <div className="flex h-screen w-full" />
          </WithSkeleton>
        }
      >
        <DeferredChatPage />
      </Suspense>
    </HydrateClient>
  );
}
