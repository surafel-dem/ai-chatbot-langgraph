import { ArtifactProvider } from '@/components/use-artifact';
import './globals.css';
import { DataStreamProvider } from '@/components/data-stream-provider';
import Link from 'next/link';
import { readAllChats } from '@util/chat-store';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI SDK - Next.js OpenAI Examples',
  description: 'Examples of using the AI SDK with Next.js and OpenAI.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const chats = await readAllChats();
  const recentChats = chats
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <html lang="en">
      <body>
        <DataStreamProvider>
          <ArtifactProvider>
            <div className="flex min-h-screen">
              <aside className="w-64 shrink-0 border-r p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Conversations</h2>
                  <Link href="/" className="text-xs underline">New</Link>
                </div>
                <ul className="space-y-1">
                  {recentChats.map(chat => (
                    <li key={chat.id}>
                      <Link
                        href={`/chat/${chat.id}`}
                        className="text-sm break-all underline hover:no-underline"
                      >
                        {chat.id}
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </ArtifactProvider>
        </DataStreamProvider>
      </body>
    </html>
  );
}
