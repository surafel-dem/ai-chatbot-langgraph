'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ShareIcon } from '@/components/icons';

interface ShareMenuItemProps {
  onShare: () => void;
  children?: ReactNode;
}

export function ShareMenuItem({ onShare, children }: ShareMenuItemProps) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  if (!isAuthenticated) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <DropdownMenuItem
            className="cursor-pointer opacity-50"
            onSelect={(e) => e.preventDefault()}
          >
            <ShareIcon />
            <span>Share</span>
          </DropdownMenuItem>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <p className="text-sm">Sign in to share your chats</p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenuItem className="cursor-pointer" onClick={onShare}>
      <ShareIcon />
      <span>Share</span>
      {children}
    </DropdownMenuItem>
  );
}
