# Convex & Clerk Integration Guide

## 📋 Overview

This guide demonstrates the production-ready integration of [Clerk](https://clerk.com) authentication with [Convex](https://convex.dev) in our AI Chat application. The implementation includes advanced guest user management, automated data cleanup, and strict security isolation.

## 🚀 Quick Start

### Prerequisites
- Existing Next.js app with Convex
- Clerk account and application setup
- Basic understanding of React hooks and Convex queries

---

## 🛠️ Setup Process

### 1. Sign up for Clerk
Sign up for a free Clerk account at https://clerk.com/sign-up.

### 2. Create an application in Clerk
Choose how you want your users to sign in (email, social providers, etc.).

### 3. Create a JWT Template
In the Clerk Dashboard:
1. Navigate to **JWT templates**
2. Click **New template**
3. Select **Convex**
4. **Important:** Do **not** rename the JWT token. It must be called `convex`.
5. Copy and save the **Issuer URL** (e.g. `https://exotic-louse-41.clerk.accounts.dev`)

### 4. Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://exotic-louse-41.clerk.accounts.dev
```

---

## 🏗️ Implementation

### 1. Install Dependencies

```bash
npm install @clerk/nextjs convex
```

### 2. Provider Setup

```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';
import { ConvexClientProvider } from './ConvexClientProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
```

```typescript
// components/ConvexClientProvider.tsx
'use client';

import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { useAuth } from '@clerk/nextjs';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
```

### 3. Authentication Configuration

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
  ]
};
```

### 4. Database Schema

```typescript
// convex/schema.ts
import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  
  // Enhanced users table for registered and guest users
  app_users: defineTable({
    email: v.optional(v.string()),
    last_seen_at: v.number(),                // Cleanup trigger
    total_conversations: v.number(),
    total_searches: v.number(),
    created_at: v.number(),
    updated_at: v.number(),
    message_count: v.number(),
    clerk_id: v.optional(v.string()),        // Registered users only
    total_tokens: v.number(),
    used_tokens: v.number(),
    last_token_refresh: v.number(),
    is_registered: v.boolean(),              // User type indicator
    role: v.string(),
    anonymous_uuid: v.optional(v.string()),  // Guest users only
  })
    .index("by_clerk_id", ["clerk_id"])
    .index("by_anonymous_uuid", ["anonymous_uuid"]),

  // Chat sessions for conversations
  chat_sessions: defineTable({
    session_id: v.string(),
    user_id: v.optional(v.id("app_users")),
    anonymous_uuid: v.optional(v.string()),
    started_at: v.number(),                  // Cleanup reference
    ended_at: v.optional(v.number()),
    message_count: v.number(),
    is_active: v.boolean(),
  })
    .index("by_session_id", ["session_id"])
    .index("by_user_id", ["user_id"])
    .index("by_anonymous_uuid", ["anonymous_uuid"]),

  // Individual messages
  messages: defineTable({
    session_id: v.string(),
    user_id: v.optional(v.id("app_users")),
    anonymous_uuid: v.optional(v.string()),
    message_id: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    created_at: v.number(),                  // Cleanup reference
  })
    .index("by_session_id", ["session_id"])
    .index("by_user_id", ["user_id"])
    .index("by_message_id", ["message_id"]),
});
```

---

## 🔐 Advanced Security Implementation

### 1. User Management with Strict Isolation

```typescript
// convex/agent.ts
export const createOrGetUser = mutation({
  args: {
    clerkId: v.optional(v.string()),
    anonymousUuid: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, anonymousUuid, email }) => {
    const now = Date.now();
    
    // Find existing user first
    let existingUser = null;
    if (clerkId) {
      existingUser = await ctx.db
        .query("app_users")
        .withIndex("by_clerk_id", (q) => q.eq("clerk_id", clerkId))
        .first();
    }
    
    if (!existingUser && anonymousUuid) {
      existingUser = await ctx.db
        .query("app_users")
        .withIndex("by_anonymous_uuid", (q) => q.eq("anonymous_uuid", anonymousUuid))
        .first();
        
      // CRITICAL: Prevent contamination
      if (existingUser && existingUser.is_registered && !clerkId) {
        throw new Error("This anonymous UUID is associated with a registered account");
      }
    }

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        last_seen_at: now,
        updated_at: now,
      });
      return existingUser._id;
    }

    // Create new user with strict isolation
    const userId = await ctx.db.insert("app_users", {
      email: email || undefined,
      last_seen_at: now,
      total_conversations: 0,
      total_searches: 0,
      created_at: now,
      updated_at: now,
      message_count: 0,
      clerk_id: clerkId || undefined,
      total_tokens: 500,
      used_tokens: 0,
      last_token_refresh: now,
      is_registered: !!clerkId,
      role: "user",
      // CRITICAL: Only assign anonymous_uuid to guest users
      anonymous_uuid: clerkId ? undefined : (anonymousUuid || undefined),
    });
    return userId;
  },
});
```

### 2. Secure Data Access

```typescript
// convex/agent.ts - Only registered users get persistent history
export const getUserChatsWithHistory = query({
  args: {
    userId: v.optional(v.id("app_users")),
    anonymousUuid: v.optional(v.string()),
  },
  handler: async (ctx, { userId, anonymousUuid }) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // CRITICAL: Only registered users get persistent history
    if (!userId || !identity) {
      return [];
    }

    const user = await ctx.db.get(userId);
    if (!user || !user.is_registered) {
      return [];
    }

    // STRICT SECURITY: Must match Clerk ID exactly
    if (user.clerk_id !== identity.subject) {
      throw new Error("Unauthorized: You can only access your own chats");
    }

    // Get latest 5 conversations for performance
    const userSessions = await ctx.db
      .query("chat_sessions")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .order("desc")
      .take(10);
    
    const filteredSessions = userSessions
      .filter(session => session.message_count > 0)
      .slice(0, 5);

    // Format and return with titles
    const chatsWithTitles = await Promise.all(
      filteredSessions.map(async (chat) => {
        const firstMessage = await ctx.db
          .query("messages")
          .withIndex("by_session_id", q => q.eq("session_id", chat.session_id))
          .order("asc")
          .first();
        
        const title = firstMessage?.content.substring(0, 50) + 
                     (firstMessage?.content.length > 50 ? "..." : "") || 
                     "Untitled Chat";
        
        return {
          id: chat.session_id,
          title,
          createdAt: new Date(chat.started_at).toISOString(),
          userId: chat.user_id,
          messageCount: chat.message_count,
          visibility: "private" as const,
        };
      })
    );

    return chatsWithTitles;
  },
});
```

---

## 🧹 Automated Data Cleanup

### 1. Cron Job Setup

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean guest data every hour to prevent database bloat
crons.interval(
  "cleanup old guest data",
  { hours: 1 },
  internal.agent.cleanupOldGuestSessions
);

export default crons;
```

### 2. Comprehensive Cleanup Function

```typescript
// convex/agent.ts
export const cleanupOldGuestSessions = internalMutation({
  handler: async (ctx) => {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Find expired guest users
    const allGuestUsers = await ctx.db
      .query("app_users")
      .filter(q => q.eq(q.field("is_registered"), false))
      .collect();
    
    const expiredGuestUsers = allGuestUsers.filter(user => 
      user.last_seen_at < twentyFourHoursAgo
    );
    
    let totalDeletedSessions = 0;
    let totalDeletedMessages = 0;
    let totalDeletedUsers = 0;
    
    // Clean up expired guest users and their data
    for (const user of expiredGuestUsers) {
      // Delete all sessions for this user
      const userSessions = await ctx.db
        .query("chat_sessions")
        .withIndex("by_user_id", q => q.eq("user_id", user._id))
        .collect();
      
      for (const session of userSessions) {
        // Delete all messages in this session
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_session_id", q => q.eq("session_id", session.session_id))
          .collect();
        
        for (const message of messages) {
          await ctx.db.delete(message._id);
          totalDeletedMessages++;
        }
        
        await ctx.db.delete(session._id);
        totalDeletedSessions++;
      }
      
      await ctx.db.delete(user._id);
      totalDeletedUsers++;
    }
    
    // Clean up orphaned data
    const orphanedSessions = await ctx.db
      .query("chat_sessions")
      .filter(q => q.and(
        q.eq(q.field("user_id"), undefined),
        q.neq(q.field("anonymous_uuid"), undefined),
        q.lt(q.field("started_at"), twentyFourHoursAgo)
      ))
      .collect();
    
    // ... cleanup orphaned sessions and messages
    
    console.log(`✅ Cleanup complete: ${totalDeletedUsers} users, ${totalDeletedSessions} sessions, ${totalDeletedMessages} messages deleted`);
    
    return {
      deletedUsers: totalDeletedUsers,
      deletedSessions: totalDeletedSessions,
      deletedMessages: totalDeletedMessages,
    };
  },
});
```

---

## 🎯 Frontend Integration

### 1. Enhanced Chat History Hook

```typescript
// hooks/use-chat-history.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { v4 as uuidv4 } from "uuid";

export function useChatHistory() {
  const [anonymousUuid, setAnonymousUuid] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<Id<"app_users"> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use Convex auth which properly integrates with Clerk
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user: clerkUser } = useUser();
  
  const clerkUserId = clerkUser?.id;
  const isSignedIn = isAuthenticated;
  
  // Initialize guest UUID in sessionStorage (more secure, auto-expires)
  useEffect(() => {
    if (!isSignedIn) {
      let uuid = sessionStorage.getItem("guest-chat-uuid");
      if (!uuid) {
        uuid = `guest_${uuidv4()}`;
        sessionStorage.setItem("guest-chat-uuid", uuid);
      }
      setAnonymousUuid(uuid);
    }
  }, []);
  
  // Nuclear cleanup: Clear ALL storage when auth state changes
  const clearAllStorageData = useCallback(() => {
    // Clear localStorage completely
    localStorage.removeItem('current-chat-session');
    const localKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('adk-session-') || 
      key.startsWith('chat-') ||
      key.startsWith('guest-')
    );
    localKeys.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage completely  
    sessionStorage.removeItem('guest-chat-uuid');
    const sessionKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith('adk-session-') || 
      key.startsWith('chat-') ||
      key.startsWith('guest-')
    );
    sessionKeys.forEach(key => sessionStorage.removeItem(key));
  }, []);

  // When user signs in: Complete isolation from guest data
  useEffect(() => {
    if (isSignedIn && anonymousUuid) {
      clearAllStorageData();
      setAnonymousUuid(null);
      setCurrentUserId(null);
      setIsInitialized(false);
    }
  }, [isSignedIn, anonymousUuid, clearAllStorageData]);

  // User initialization
  const createOrGetUser = useMutation(api.agent.createOrGetUser);
  
  useEffect(() => {
    const initializeUser = async () => {
      if (isInitialized) return;

      try {
        if (isSignedIn && clerkUserId) {
          // Registered user - NEVER include anonymousUuid
          const userId = await createOrGetUser({
            clerkId: clerkUserId,
            email: clerkUser?.emailAddresses[0]?.emailAddress,
          });
          setCurrentUserId(userId);
        } else if (!isSignedIn && anonymousUuid) {
          // Guest user
          const userId = await createOrGetUser({
            anonymousUuid,
          });
          setCurrentUserId(userId);
        }
        setIsInitialized(true);
      } catch (error) {
        console.error("❌ Error initializing user:", error);
        setIsInitialized(true);
      }
    };

    if (!isInitialized && !isLoading) {
      if ((isSignedIn && clerkUserId) || (!isSignedIn && anonymousUuid)) {
        initializeUser();
      }
    }
  }, [isSignedIn, clerkUserId, clerkUser, anonymousUuid, createOrGetUser, isInitialized, isLoading]);

  // Get chat history ONLY for registered users
  const queryParams = isInitialized && !isLoading && currentUserId && isSignedIn
    ? { userId: currentUserId }
    : "skip";

  const chatHistory = useQuery(api.agent.getUserChatsWithHistory, queryParams);
  
  return {
    chatHistory: chatHistory || [],
    isAuthenticated,
    currentUserId,
    anonymousUuid: !isSignedIn ? anonymousUuid : null,
    isInitialized,
  };
}
```

### 2. Smart Sidebar Management

```typescript
// components/AuthAwareSidebarProvider.tsx
"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useChatHistory } from "@/hooks/use-chat-history";
import { ReactNode } from "react";

interface AuthAwareSidebarProviderProps {
  children: ReactNode;
}

export function AuthAwareSidebarProvider({ children }: AuthAwareSidebarProviderProps) {
  const { isAuthenticated } = useChatHistory();
  
  // Guests: sidebar closed by default (no persistent history)
  // Registered users: sidebar open by default (has history to show)
  const defaultOpen = isAuthenticated;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {children}
    </SidebarProvider>
  );
}
```

### 3. Guest-Aware Sidebar History

```typescript
// components/sidebar-history.tsx
export function SidebarHistory() {
  const { chatHistory, isAuthenticated } = useChatHistory();

  // GUEST USERS: Don't show history, encourage registration
  if (!isAuthenticated) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Chat History</SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="text-zinc-500 text-sm px-2 py-4 text-center space-y-2">
            <p>💬 Chat as guest</p>
            <p className="text-xs text-zinc-400">
              Register to manage and save your chat history
            </p>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // REGISTERED USERS: Show latest 5 conversations
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        Recent Chats
        {chatHistory.length === 5 && (
          <span className="text-xs text-sidebar-foreground/50 ml-1">(Latest 5)</span>
        )}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <AnimatePresence mode="popLayout">
            {chatHistory.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                // ... other props
              />
            ))}
          </AnimatePresence>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

---

## 🔧 Database Health Monitoring

### Monitor Guest Data

```typescript
// convex/agent.ts
export const getGuestDataStatus = query({
  handler: async (ctx) => {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    const allGuestUsers = await ctx.db
      .query("app_users")
      .filter(q => q.eq(q.field("is_registered"), false))
      .collect();
    
    const activeGuests = allGuestUsers.filter(u => u.last_seen_at >= twentyFourHoursAgo);
    const expiredGuests = allGuestUsers.filter(u => u.last_seen_at < twentyFourHoursAgo);
    
    return {
      guestUsers: {
        total: allGuestUsers.length,
        active: activeGuests.length,
        expired: expiredGuests.length,
      },
      databaseHealth: {
        status: expiredGuests.length > 50 ? 'needs_cleanup' : 'healthy',
      },
    };
  },
});
```

---

## ✅ Production Checklist

### Security
- [x] Complete user data isolation (guest vs registered)
- [x] Strict Clerk ID validation for registered users
- [x] No cross-contamination between user types
- [x] sessionStorage for guest data (auto-expires)
- [x] Comprehensive storage cleanup on auth changes

### Performance
- [x] Limited history queries (latest 5 conversations)
- [x] Efficient database indexes
- [x] Automated cleanup prevents database bloat
- [x] Optimized query patterns with "skip" logic

### User Experience
- [x] Smart sidebar behavior (closed for guests, open for registered)
- [x] Smooth animations prevent UI flicker
- [x] Clear messaging for guest users
- [x] Seamless authentication flow

### Monitoring
- [x] Database health monitoring queries
- [x] Comprehensive cleanup logging
- [x] Manual cleanup triggers for admin use
- [x] Guest data status reporting

---

## 🎯 Key Benefits

1. **Security**: Complete isolation prevents data leaks
2. **Performance**: Automated cleanup prevents database bloat
3. **UX**: Smart defaults provide intuitive experience
4. **Scalability**: Handles unlimited guest users efficiently
5. **Maintainability**: Clear separation of concerns

---

**Last Updated**: 2025-01-14  
**Version**: 2.0  
**Status**: Production Ready ✅  
**Guest Management**: Automated ✅  
**Data Cleanup**: 24-Hour Automated ✅