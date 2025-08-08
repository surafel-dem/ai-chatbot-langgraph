import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new chat
 */
export const createChat = mutation({
  args: {
    id: v.string(),
    user_id: v.id("users"),
    title: v.string(),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const chatId = await ctx.db.insert("chats", {
      id: args.id,
      user_id: args.user_id,
      title: args.title,
      visibility: args.visibility || "private",
      message_count: 0,
      created_at: now,
      updated_at: now,
    });

    // Update user's chat count
    const user = await ctx.db.get(args.user_id);
    if (user) {
      await ctx.db.patch(args.user_id, {
        chat_count: user.chat_count + 1,
        updated_at: now,
      });
    }

    return chatId;
  },
});

/**
 * Get user's chats
 */
export const getUserChats = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user) return [];

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user", (q) => q.eq("user_id", user._id))
      .order("desc")
      .take(args.limit || 50);

    return chats;
  },
});

/**
 * Get user's chats by user ID (for API routes)
 */
export const getUserChatsById = query({
  args: {
    user_id: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user", (q) => q.eq("user_id", args.user_id))
      .order("desc")
      .take(args.limit || 50);

    return chats;
  },
});

/**
 * Get chat by ID
 */
export const getChatById = query({
  args: { 
    chat_id: v.string() 
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_custom_id", (q) => q.eq("id", args.chat_id))
      .first();
    return chat;
  },
});

/**
 * Update chat title
 */
export const updateChatTitle = mutation({
  args: {
    chat_id: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_custom_id", (q) => q.eq("id", args.chat_id))
      .first();
      
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Verify ownership
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user || chat.user_id !== user._id) {
      throw new Error("Unauthorized: You can only update your own chats");
    }

    await ctx.db.patch(chat._id, {
      title: args.title,
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete chat and all related data
 */
export const deleteChat = mutation({
  args: { 
    chat_id: v.string() 
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_custom_id", (q) => q.eq("id", args.chat_id))
      .first();
      
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Verify ownership
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user || chat.user_id !== user._id) {
      throw new Error("Unauthorized: You can only delete your own chats");
    }

    // Delete all messages in the chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chat_id", args.chat_id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all votes in the chat
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_chat", (q) => q.eq("chat_id", args.chat_id))
      .collect();

    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // Delete the chat
    await ctx.db.delete(chat._id);

    // Update user's chat count
    await ctx.db.patch(user._id, {
      chat_count: Math.max(0, user.chat_count - 1),
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Send a message
 */
export const sendMessage = mutation({
  args: {
    ui_id: v.optional(v.string()),
    chat_id: v.string(),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    parts: v.optional(v.array(v.object({
      type: v.string(),
      text: v.optional(v.string()),
      image: v.optional(v.string()),
      data: v.optional(v.any()),
      state: v.optional(v.string()),
      providerMetadata: v.optional(v.any()),
      callProviderMetadata: v.optional(v.any()),
      toolCallId: v.optional(v.string()),
      input: v.optional(v.any()),
      output: v.optional(v.any()),
    }))),
    attachments: v.optional(v.array(v.object({
      file_id: v.optional(v.id("files")),
      url: v.string(),
      name: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_custom_id", (q) => q.eq("id", args.chat_id))
      .first();
      
    if (!chat) {
      throw new Error("Chat not found");
    }

    const now = Date.now();

    // Create message
    const messageId = await ctx.db.insert("messages", {
      ui_id: args.ui_id,
      chat_id: args.chat_id,
      user_id: chat.user_id,
      role: args.role,
      content: args.content,
      parts: args.parts,
      attachments: args.attachments,
      model: args.model,
      created_at: now,
    });

    // Update chat metadata
    await ctx.db.patch(chat._id, {
      message_count: chat.message_count + 1,
      last_message_at: now,
      updated_at: now,
    });

    // Update user's message count
    const user = await ctx.db.get(chat.user_id);
    if (user) {
      await ctx.db.patch(chat.user_id, {
        message_count: user.message_count + 1,
        last_seen_at: now,
      });
    }

    return messageId;
  },
});

/**
 * Get messages for a chat
 */
export const getChatMessagesById = query({
  args: {
    chat_id: v.string(),
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chat_id", args.chat_id));

    if (args.before) {
      query = query.filter((q) => q.lt(q.field("created_at"), args.before!));
    }

    const messages = await query
      .order("desc")
      .take(args.limit || 100);

    // Return in chronological order
    return messages.reverse();
  },
});

/**
 * Start a streaming session
 */
export const startStream = mutation({
  args: {
    chat_id: v.string(),
    stream_id: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_custom_id", (q) => q.eq("id", args.chat_id))
      .first();
      
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Check if stream already exists
    const existingStream = await ctx.db
      .query("streams")
      .withIndex("by_stream_id", (q) => q.eq("stream_id", args.stream_id))
      .first();

    if (existingStream) {
      return existingStream._id;
    }

    // Create new stream
    const streamId = await ctx.db.insert("streams", {
      chat_id: args.chat_id,
      user_id: chat.user_id,
      stream_id: args.stream_id,
      status: "active",
      started_at: Date.now(),
    });

    return streamId;
  },
});

/**
 * Complete streaming session
 */
export const completeStream = mutation({
  args: {
    stream_id: v.string(),
    final_message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const stream = await ctx.db
      .query("streams")
      .withIndex("by_stream_id", (q) => q.eq("stream_id", args.stream_id))
      .first();

    if (!stream) {
      throw new Error("Stream not found");
    }

    await ctx.db.patch(stream._id, {
      status: "completed",
      partial_message: args.final_message,
      completed_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get active streams for a chat
 */
export const getActiveStreams = query({
  args: {
    chat_id: v.string(),
  },
  handler: async (ctx, args) => {
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chat", (q) => q.eq("chat_id", args.chat_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    
    return streams;
  },
});