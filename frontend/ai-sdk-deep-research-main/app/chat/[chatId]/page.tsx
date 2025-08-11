import { readChat } from '@util/chat-store';
import Link from 'next/link';
import Chat from './chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
  
export default async function Page(props: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await props.params; // get the chat ID from the URL
  const chatData = await readChat(chatId); // load the chat

  return (
    <div>
      <Chat chatData={chatData} resume={chatData.activeStreamId !== null} />
      <DataStreamHandler id={chatId} />
    </div>
  );
}
