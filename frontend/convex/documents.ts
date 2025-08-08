import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Create a new document
 */
export const createDocument = mutation({
  args: {
    id: v.string(),
    user_id: v.id("users"),
    title: v.string(),
    content: v.optional(v.string()),
    kind: v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("image"),
      v.literal("sheet")
    ),
    language: v.optional(v.string()),
    chat_id: v.optional(v.string()),
    message_id: v.optional(v.id("messages")),
    is_published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.user_id);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();

    const documentId = await ctx.db.insert("documents", {
      id: args.id,
      user_id: user._id,
      title: args.title,
      content: args.content,
      kind: args.kind,
      language: args.language,
      chat_id: args.chat_id,
      message_id: args.message_id,
      version: 1,
      is_published: args.is_published || false,
      created_at: now,
      updated_at: now,
    });

    // Update user's document count
    await ctx.db.patch(user._id, {
      document_count: user.document_count + 1,
      updated_at: now,
    });

    return documentId;
  },
});

/**
 * Get document by ID
 */
export const getDocumentById = query({
  args: { 
    document_id: v.string() 
  },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("documents")
      .withIndex("by_custom_id", (q) => q.eq("id", args.document_id))
      .first();
    return document;
  },
});

/**
 * Alias used by tools expecting api.documents.getDocument
 */
export const getDocument = query({
  args: {
    document_id: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("documents")
      .withIndex("by_custom_id", (q) => q.eq("id", args.document_id))
      .first();
    return document;
  },
});

/**
 * Get user's documents
 */
export const getUserDocuments = query({
  args: {
    kind: v.optional(v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("image"),
      v.literal("sheet")
    )),
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

    let query = ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("user_id", user._id));

    if (args.kind) {
      query = query.filter((q) => q.eq(q.field("kind"), args.kind));
    }

    const documents = await query
      .order("desc")
      .take(args.limit || 50);

    return documents;
  },
});

/**
 * Update document
 */
export const updateDocument = mutation({
  args: {
    document_id: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    language: v.optional(v.string()),
    is_published: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("documents")
      .withIndex("by_custom_id", (q) => q.eq("id", args.document_id))
      .first();
      
    if (!document) {
      throw new Error("Document not found");
    }

    // Check ownership
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user || document.user_id !== user._id) {
      throw new Error("Unauthorized: You can only update your own documents");
    }

    const updates: any = {
      updated_at: Date.now(),
      version: document.version + 1,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.language !== undefined) updates.language = args.language;
    if (args.is_published !== undefined) updates.is_published = args.is_published;

    await ctx.db.patch(document._id, updates);

    return { success: true };
  },
});

/**
 * Delete document
 */
export const deleteDocument = mutation({
  args: { 
    document_id: v.string() 
  },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("documents")
      .withIndex("by_custom_id", (q) => q.eq("id", args.document_id))
      .first();
      
    if (!document) {
      throw new Error("Document not found");
    }

    // Check ownership
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user || document.user_id !== user._id) {
      throw new Error("Unauthorized: You can only delete your own documents");
    }

    // Delete all suggestions for this document
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_document", (q) => q.eq("document_id", args.document_id))
      .collect();

    for (const suggestion of suggestions) {
      await ctx.db.delete(suggestion._id);
    }

    // Delete the document
    await ctx.db.delete(document._id);

    // Update user's document count
    await ctx.db.patch(user._id, {
      document_count: Math.max(0, user.document_count - 1),
      updated_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Create a suggestion
 */
export const createSuggestion = mutation({
  args: {
    document_id: v.string(),
    original_text: v.string(),
    suggested_text: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const document = await ctx.db
      .query("documents")
      .withIndex("by_custom_id", (q) => q.eq("id", args.document_id))
      .first();
      
    if (!document) {
      throw new Error("Document not found");
    }

    const suggestionId = await ctx.db.insert("suggestions", {
      document_id: args.document_id,
      user_id: user._id,
      original_text: args.original_text,
      suggested_text: args.suggested_text,
      description: args.description,
      is_resolved: false,
      created_at: Date.now(),
    });

    return suggestionId;
  },
});

/**
 * Vote on a message
 */
export const voteMessage = mutation({
  args: {
    message_id: v.union(v.id("messages"), v.string()),
    is_upvoted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const message: Doc<"messages"> | null =
      typeof args.message_id === "string"
        ? await ctx.db
            .query("messages")
            .withIndex("by_ui_id", (q) => q.eq("ui_id", args.message_id as string))
            .first()
        : await ctx.db.get(args.message_id as Id<"messages">);
    if (!message) throw new Error("Message not found");

    // Check if user already voted
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("unique_vote", (q) => 
        q.eq("message_id", message._id).eq("user_id", user._id)
      )
      .first();

    if (existingVote) {
      // Update existing vote
      await ctx.db.patch(existingVote._id, {
        is_upvoted: args.is_upvoted,
      });
      return { action: "updated", vote_id: existingVote._id };
    } else {
      // Create new vote
      const voteId = await ctx.db.insert("votes", {
        message_id: message._id,
        user_id: user._id,
        chat_id: message.chat_id,
        is_upvoted: args.is_upvoted,
        created_at: Date.now(),
      });
      return { action: "created", vote_id: voteId };
    }
  },
});

/**
 * Get chat vote statistics
 */
export const getChatVoteStats = query({
  args: { 
    chat_id: v.string() 
  },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_chat", (q) => q.eq("chat_id", args.chat_id))
      .collect();

    const upvotes = votes.filter(v => v.is_upvoted).length;
    const downvotes = votes.filter(v => !v.is_upvoted).length;

    // Group by message
    const messageVotes = new Map<string, { up: number; down: number }>();
    for (const vote of votes) {
      const key = vote.message_id;
      if (!messageVotes.has(key)) {
        messageVotes.set(key, { up: 0, down: 0 });
      }
      const stats = messageVotes.get(key)!;
      if (vote.is_upvoted) {
        stats.up++;
      } else {
        stats.down++;
      }
    }

    return {
      totalUpvotes: upvotes,
      totalDownvotes: downvotes,
      messageCount: messageVotes.size,
      bestMessages: Array.from(messageVotes.entries())
        .map(([id, stats]) => ({ id, score: stats.up - stats.down }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    };
  },
});

/**
 * Get suggestions for a document
 */
export const getDocumentSuggestions = query({
  args: {
    document_id: v.string(),
  },
  handler: async (ctx, args) => {
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_document", (q) => q.eq("document_id", args.document_id))
      .order("desc")
      .take(200);
    return suggestions;
  },
});