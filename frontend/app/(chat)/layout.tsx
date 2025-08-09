import { cookies } from 'next/headers';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getAuthUser } from '@/lib/auth';
import Script from 'next/script';
import { DataStreamProvider } from '@/components/data-stream-provider';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { AnonymousSessionInit } from '@/components/anonymous-session-init';

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, cookieStore] = await Promise.all([getAuthUser(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';
  
  console.log('🏗️ Layout - user from getAuthUser():', user);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <SidebarProvider defaultOpen={!isCollapsed}>
          <AppSidebar user={user} />
          {/* Initialize anonymous session cookie for guests so credit banner can read it */}
          <AnonymousSessionInit />
          <SidebarInset>
            {children}
            <DataStreamHandler />
          </SidebarInset>
        </SidebarProvider>
      </DataStreamProvider>
    </>
  );
}
