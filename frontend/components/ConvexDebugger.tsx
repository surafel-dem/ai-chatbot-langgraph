'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';

export function ConvexDebugger() {
  const { user: clerkUser } = useUser();
  
  // Get current user from Convex
  const convexUser = useQuery(api.users.getUser, {});
  
  // Get all users to see both registered and guest users
  const allUsers = useQuery(api.users.getAllUsers, {}) || [];
  
  // Get user chats
  const userChats = useQuery(api.chats.getUserChats, { limit: 20 });
  
  if (!clerkUser) {
    return <div className="p-4 bg-gray-100 m-4 rounded">
      <h3 className="font-bold">🔍 Convex Debugger</h3>
      <p>Not logged in with Clerk</p>
    </div>;
  }

  return (
    <div className="p-4 bg-gray-100 m-4 rounded text-xs">
      <h3 className="font-bold mb-2">🔍 Convex Database Debug</h3>
      
      <div className="mb-2">
        <strong>Clerk User:</strong> {clerkUser.id} ({clerkUser.emailAddresses?.[0]?.emailAddress})
      </div>
      
      <div className="mb-2">
        <strong>Convex User:</strong> {convexUser ? 'EXISTS' : 'NULL'}
        {convexUser && (
          <div className="ml-2 text-gray-600">
            ID: {convexUser._id}<br/>
            Clerk ID: {convexUser.clerk_id}<br/>
            Email: {convexUser.email}<br/>
            Chat Count: {convexUser.chat_count || 0}
          </div>
        )}
      </div>
      
      <div className="mb-2">
        <strong>Total Users in DB:</strong> {allUsers.length}
        <div className="ml-2 text-gray-600">
          {allUsers.slice(0, 3).map((user, i) => (
            <div key={i}>
              {user.is_guest ? '👤 Guest' : '🔐 Registered'}: {user.email || user.guest_id} 
              (chats: {user.chat_count || 0})
            </div>
          ))}
          {allUsers.length > 3 && <div>...and {allUsers.length - 3} more</div>}
        </div>
      </div>
      
      <div className="mb-2">
        <strong>User Chats:</strong> {userChats?.length || 0}
        {userChats?.slice(0, 3).map((chat, i) => (
          <div key={i} className="ml-2 text-gray-600">
            📝 {chat.title} (messages: {chat.message_count})
          </div>
        ))}
      </div>
    </div>
  );
}