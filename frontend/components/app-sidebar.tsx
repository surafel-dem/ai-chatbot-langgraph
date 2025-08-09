'use client';

import type { AuthUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useEffect, useState } from 'react';
import { featureFlags } from '@/lib/feature-flags';

export function AppSidebar({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const [guestCredits, setGuestCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!featureFlags.credits) return;
    if (user) return; // show only for guests
    try {
      const read = () => {
        const cookie = document.cookie
          .split('; ')
          .find((row) => row.startsWith('anonymous-session='));
        if (!cookie) return;
        const value = decodeURIComponent(cookie.split('=')[1]);
        const parsed = JSON.parse(value);
        if (typeof parsed?.remainingCredits === 'number') {
          setGuestCredits(parsed.remainingCredits);
        }
      };
      read();
      const id = setInterval(read, 1000);
      return () => clearInterval(id);
    } catch {
      // ignore
    }
  }, [user]);

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                Chatbot
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>
        <div className="w-full">
          {featureFlags.credits && !user && (
            <div className="mb-2 text-xs rounded-md border px-3 py-2 flex items-center justify-between">
              <span>Credits remaining</span>
              <span className="font-semibold">
                {guestCredits !== null ? guestCredits : '—'}
              </span>
            </div>
          )}
          <SidebarUserNav user={user} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
