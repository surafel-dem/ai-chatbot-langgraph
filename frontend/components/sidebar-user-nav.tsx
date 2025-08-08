'use client';

import { ChevronUp } from 'lucide-react';
import Image from 'next/image';
import { useClerk, useUser, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import type { AuthUser } from '@/lib/auth';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { LoaderIcon } from './icons';

export function SidebarUserNav({ user }: { user: AuthUser | null }) {
  const { signOut } = useClerk();
  const { isLoaded, user: clerkUser } = useUser();
  const { setTheme, resolvedTheme } = useTheme();

  const isGuest = !clerkUser;

  console.log('🔍 SidebarUserNav state:');
  console.log('  - isLoaded:', isLoaded);
  console.log('  - clerkUser exists:', clerkUser ? '✅ EXISTS' : '❌ NULL');
  console.log('  - clerkUserId:', clerkUser?.id);
  console.log('  - emailAddresses:', clerkUser?.emailAddresses?.map(e => e.emailAddress));
  console.log('  - isGuest:', isGuest);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {!isLoaded ? (
              <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10 justify-between">
                <div className="flex flex-row gap-2">
                  <div className="size-6 bg-zinc-500/30 rounded-full animate-pulse" />
                  <span className="bg-zinc-500/30 text-transparent rounded-md animate-pulse">
                    Loading auth status
                  </span>
                </div>
                <div className="animate-spin text-zinc-500">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                data-testid="user-nav-button"
                className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10"
              >
                <Image
                  src={clerkUser?.imageUrl || `https://avatar.vercel.sh/${isGuest ? 'guest' : user?.id}`}
                  alt={clerkUser?.emailAddresses[0]?.emailAddress ?? 'User Avatar'}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <span data-testid="user-email" className="truncate">
                  {isGuest ? 'Guest User' : clerkUser?.emailAddresses[0]?.emailAddress}
                </span>
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-testid="user-nav-menu"
            side="top"
            className="w-[--radix-popper-anchor-width]"
          >
            <DropdownMenuItem
              data-testid="user-nav-item-theme"
              className="cursor-pointer"
              onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {`Toggle ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isGuest ? (
              <>
                <DropdownMenuItem asChild data-testid="user-nav-item-signin">
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="w-full cursor-pointer text-left px-2 py-1.5 text-sm"
                    >
                      Sign in
                    </button>
                  </SignInButton>
                </DropdownMenuItem>
                <DropdownMenuItem asChild data-testid="user-nav-item-register">
                  <SignUpButton mode="modal">
                    <button
                      type="button"
                      className="w-full cursor-pointer text-left px-2 py-1.5 text-sm"
                    >
                      Create account
                    </button>
                  </SignUpButton>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem asChild data-testid="user-nav-item-auth">
                <button
                  type="button"
                  className="w-full cursor-pointer"
                  onClick={() => signOut()}
                >
                  Sign out
                </button>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
