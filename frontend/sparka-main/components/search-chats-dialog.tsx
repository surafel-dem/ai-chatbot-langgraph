'use client';

import { useMemo, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useGetAllChats } from '@/hooks/chat-sync-hooks';
import type { UIChat } from '@/lib/types/uiChat';

type GroupedChats = {
  today: UIChat[];
  yesterday: UIChat[];
  lastWeek: UIChat[];
  lastMonth: UIChat[];
  older: UIChat[];
};

const groupChatsByDate = (chats: UIChat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
};

interface SearchChatsListProps {
  onSelectChat: (chatId: string) => void;
}

function SearchChatsList({ onSelectChat }: SearchChatsListProps) {
  const { data: chats, isLoading } = useGetAllChats();

  const groupedChats = useMemo(() => {
    if (!chats) return null;
    return groupChatsByDate(chats);
  }, [chats]);

  const renderChatGroup = (
    groupChats: UIChat[],
    groupName: string,
    key: string,
  ) => {
    if (groupChats.length === 0) return null;

    return (
      <CommandGroup heading={groupName} key={key}>
        {groupChats.map((chat) => (
          <CommandItem
            key={chat.id}
            value={`${chat.title} ${chat.id}`}
            onSelect={() => onSelectChat(chat.id)}
            className="flex items-center gap-2 p-2 cursor-pointer"
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate">{chat.title}</span>
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <>
      <CommandEmpty>
        {isLoading ? 'Loading chats...' : 'No chats found.'}
      </CommandEmpty>

      {groupedChats && (
        <>
          {renderChatGroup(groupedChats.today, 'Today', 'today')}
          {renderChatGroup(groupedChats.yesterday, 'Yesterday', 'yesterday')}
          {renderChatGroup(groupedChats.lastWeek, 'Last 7 days', 'lastWeek')}
          {renderChatGroup(groupedChats.lastMonth, 'Last 30 days', 'lastMonth')}
          {renderChatGroup(groupedChats.older, 'Older', 'older')}
        </>
      )}
    </>
  );
}

interface SearchChatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectChat: () => void;
}

export function SearchChatsDialog({
  open,
  onOpenChange,
  onSelectChat,
}: SearchChatsDialogProps) {
  const handleSelectChat = useCallback(
    (chatId: string) => {
      onOpenChange(false);
      onSelectChat();
      window.history.pushState(null, '', `/chat/${chatId}`);
    },
    [onOpenChange, onSelectChat],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search your chats..." />
      <CommandList>
        {open && <SearchChatsList onSelectChat={handleSelectChat} />}
      </CommandList>
    </CommandDialog>
  );
}
