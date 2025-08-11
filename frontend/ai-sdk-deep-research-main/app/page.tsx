import { generateId } from 'ai';
import Chat from './chat/[chatId]/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';

export default async function ChatPage() {
  const id = generateId();
  return <div className="flex flex-col h-screen">
    <Chat chatData={{ id, messages: [] }} isNewChat />
    <DataStreamHandler id={id} />

  </div>;
}
