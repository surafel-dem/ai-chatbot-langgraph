import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Schedule cron jobs
const crons = cronJobs();

// Run every hour to clean up expired guest sessions
crons.hourly(
  "cleanup expired guest sessions",
  { minuteUTC: 0 },
  internal.crons.cleanupGuestSessions
);

// Run daily to clean up old guest data (24+ hours)
crons.daily(
  "cleanup old guest data",
  { hourUTC: 2, minuteUTC: 0 },
  internal.crons.cleanupOldGuestData
);

// Clean up expired guest sessions
export const cleanupGuestSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find expired guest sessions
    const expiredSessions = await ctx.db
      .query("guest_sessions")
      .withIndex("by_expires", (q) => q.lt("expires_at", now))
      .collect();

    let cleanedSessions = 0;
    let cleanedUsers = 0;
    let cleanedChats = 0;
    let cleanedMessages = 0;

    for (const session of expiredSessions) {
      // Mark for deletion
      await ctx.db.patch(session._id, {
        marked_for_deletion: true,
      });

      // Find the guest user
      const guestUser = await ctx.db
        .query("users")
        .withIndex("by_guest_id", (q) => q.eq("guest_id", session.guest_id))
        .first();

      if (guestUser) {
        // Delete user's chats
        const chats = await ctx.db
          .query("chats")
          .withIndex("by_user", (q) => q.eq("user_id", guestUser._id))
          .collect();

        for (const chat of chats) {
          // Delete messages
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chat_id", chat.id))
            .collect();
          
          for (const message of messages) {
            await ctx.db.delete(message._id);
            cleanedMessages++;
          }

          // Delete votes
          const votes = await ctx.db
            .query("votes")
            .withIndex("by_chat", (q) => q.eq("chat_id", chat.id))
            .collect();
          
          for (const vote of votes) {
            await ctx.db.delete(vote._id);
          }

          await ctx.db.delete(chat._id);
          cleanedChats++;
        }

        // Delete user's documents
        const documents = await ctx.db
          .query("documents")
          .withIndex("by_user", (q) => q.eq("user_id", guestUser._id))
          .collect();

        for (const doc of documents) {
          // Delete suggestions
          const suggestions = await ctx.db
            .query("suggestions")
            .withIndex("by_document", (q) => q.eq("document_id", doc.id))
            .collect();
          
          for (const suggestion of suggestions) {
            await ctx.db.delete(suggestion._id);
          }

          await ctx.db.delete(doc._id);
        }

        // Delete the guest user
        await ctx.db.delete(guestUser._id);
        cleanedUsers++;
      }

      // Delete the session
      await ctx.db.delete(session._id);
      cleanedSessions++;
    }

    console.log(`Guest cleanup completed: ${cleanedSessions} sessions, ${cleanedUsers} users, ${cleanedChats} chats, ${cleanedMessages} messages`);
    
    return {
      sessions: cleanedSessions,
      users: cleanedUsers,
      chats: cleanedChats,
      messages: cleanedMessages,
    };
  },
});

// Clean up old guest data (24+ hours old)
export const cleanupOldGuestData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    // Find old guest users (inactive for 24+ hours)
    const allGuestUsers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("is_guest"), true))
      .collect();

    const oldGuestUsers = allGuestUsers.filter(
      user => user.last_seen_at < twentyFourHoursAgo
    );

    let cleanedUsers = 0;
    let cleanedChats = 0;
    let cleanedMessages = 0;

    for (const user of oldGuestUsers) {
      // Delete user's chats
      const chats = await ctx.db
        .query("chats")
        .withIndex("by_user", (q) => q.eq("user_id", user._id))
        .collect();

      for (const chat of chats) {
        // Delete messages
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chat_id", chat.id))
          .collect();
        
        for (const message of messages) {
          await ctx.db.delete(message._id);
          cleanedMessages++;
        }

        // Delete votes
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_chat", (q) => q.eq("chat_id", chat.id))
          .collect();
        
        for (const vote of votes) {
          await ctx.db.delete(vote._id);
        }

        // Delete streams
        const streams = await ctx.db
          .query("streams")
          .withIndex("by_chat", (q) => q.eq("chat_id", chat.id))
          .collect();
        
        for (const stream of streams) {
          await ctx.db.delete(stream._id);
        }

        await ctx.db.delete(chat._id);
        cleanedChats++;
      }

      // Delete user's documents
      const documents = await ctx.db
        .query("documents")
        .withIndex("by_user", (q) => q.eq("user_id", user._id))
        .collect();

      for (const doc of documents) {
        // Delete suggestions
        const suggestions = await ctx.db
          .query("suggestions")
          .withIndex("by_document", (q) => q.eq("document_id", doc.id))
          .collect();
        
        for (const suggestion of suggestions) {
          await ctx.db.delete(suggestion._id);
        }

        await ctx.db.delete(doc._id);
      }

      // Delete guest sessions if user has guest_id
      if (user.guest_id) {
        const sessions = await ctx.db
          .query("guest_sessions")
          .withIndex("by_guest_id", (q) => q.eq("guest_id", user.guest_id!))
          .collect();
        
        for (const session of sessions) {
          await ctx.db.delete(session._id);
        }
      }

      // Delete the user
      await ctx.db.delete(user._id);
      cleanedUsers++;
    }

    console.log(`Old guest data cleanup completed: ${cleanedUsers} users, ${cleanedChats} chats, ${cleanedMessages} messages`);
    
    return {
      users: cleanedUsers,
      chats: cleanedChats,
      messages: cleanedMessages,
    };
  },
});

// Get cleanup statistics
export const getCleanupStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    // Count guest users
    const allGuestUsers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("is_guest"), true))
      .collect();
    
    const oldGuestUsers = allGuestUsers.filter(
      user => user.last_seen_at < twentyFourHoursAgo
    );
    
    // Count expired sessions
    const expiredSessions = await ctx.db
      .query("guest_sessions")
      .withIndex("by_expires", (q) => q.lt("expires_at", now))
      .collect();
    
    return {
      guestUsers: {
        total: allGuestUsers.length,
        old: oldGuestUsers.length,
      },
      expiredSessions: expiredSessions.length,
      nextCleanup: {
        guests: "Next hour at :00",
        oldData: "Daily at 2:00 AM UTC",
      },
    };
  },
});

export default crons;