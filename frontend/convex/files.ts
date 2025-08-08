import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate upload URL for client-side upload
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Must be logged in to upload files");
    }

    // Generate and return upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

// Store file reference after successful upload
export const createFile = mutation({
  args: {
    storage_id: v.string(),
    filename: v.string(),
    mime_type: v.string(),
    size: v.number(),
    chat_id: v.optional(v.id("chats")),
    message_id: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Create file record
    const fileId = await ctx.db.insert("files", {
      user_id: user._id,
      storage_id: args.storage_id,
      filename: args.filename,
      mime_type: args.mime_type,
      size: args.size,
      chat_id: args.chat_id,
      message_id: args.message_id,
      status: "ready",
      created_at: Date.now(),
    });

    // Get URL for the file
    const url = await ctx.storage.getUrl(args.storage_id);

    return { fileId, url };
  },
});

// Get file by ID
export const getFile = query({
  args: { file_id: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.file_id);
    if (!file) return null;

    // Get fresh URL if needed
    if (!file.url && file.storage_id) {
      const url = await ctx.storage.getUrl(file.storage_id);
      if (url) {
        return { ...file, url };
      }
    }

    return file;
  },
});

// Get files for a chat
export const getChatFiles = query({
  args: { chat_id: v.id("chats") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_chat", (q) => q.eq("chat_id", args.chat_id))
      .filter((q) => q.eq(q.field("status"), "ready"))
      .collect();

    // Get URLs for all files
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        if (!file.url && file.storage_id) {
          const url = await ctx.storage.getUrl(file.storage_id);
          return { ...file, url };
        }
        return file;
      })
    );

    return filesWithUrls;
  },
});

// Get user's files
export const getUserFiles = query({
  args: { 
    limit: v.optional(v.number()),
    mime_type_filter: v.optional(v.string()),
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
      .query("files")
      .withIndex("by_user", (q) => q.eq("user_id", user._id))
      .filter((q) => q.eq(q.field("status"), "ready"));

    // Apply mime type filter if provided
    if (args.mime_type_filter) {
      query = query.filter((q) => 
        q.eq(q.field("mime_type"), args.mime_type_filter)
      );
    }

    const files = await query
      .order("desc")
      .take(args.limit || 50);

    // Get URLs
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        if (!file.url && file.storage_id) {
          const url = await ctx.storage.getUrl(file.storage_id);
          return { ...file, url };
        }
        return file;
      })
    );

    return filesWithUrls;
  },
});

// Delete a file
export const deleteFile = mutation({
  args: { file_id: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const file = await ctx.db.get(args.file_id);
    if (!file) {
      throw new Error("File not found");
    }

    // Check ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user || file.user_id !== user._id) {
      throw new Error("Unauthorized: You can only delete your own files");
    }

    // Delete from storage
    if (file.storage_id) {
      await ctx.storage.delete(file.storage_id);
    }

    // Delete record
    await ctx.db.delete(args.file_id);

    return { success: true };
  },
});

// Generate upload URL for guest users
export const generateGuestUploadUrl = mutation({
  args: { 
    guest_id: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify guest exists
    const guest = await ctx.db
      .query("users")
      .withIndex("by_guest_id", (q) => q.eq("guest_id", args.guest_id))
      .first();

    if (!guest || !guest.is_guest) {
      throw new Error("Invalid guest ID");
    }

    // Generate upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

// Create temporary file for guest
export const createGuestFile = mutation({
  args: {
    guest_id: v.string(),
    storage_id: v.string(),
    filename: v.string(),
    mime_type: v.string(),
    size: v.number(),
    chat_id: v.optional(v.id("chats")),
  },
  handler: async (ctx, args) => {
    // Get guest user
    const guest = await ctx.db
      .query("users")
      .withIndex("by_guest_id", (q) => q.eq("guest_id", args.guest_id))
      .first();

    if (!guest || !guest.is_guest) {
      throw new Error("Invalid guest ID");
    }

    const now = Date.now();
    const expiresIn24Hours = now + (24 * 60 * 60 * 1000);

    // Create temporary file record
    const fileId = await ctx.db.insert("files", {
      user_id: guest._id,
      storage_id: args.storage_id,
      filename: args.filename,
      mime_type: args.mime_type,
      size: args.size,
      chat_id: args.chat_id,
      status: "ready",
      created_at: now,
      expires_at: expiresIn24Hours, // Auto-delete after 24 hours
    });

    // Get URL
    const url = await ctx.storage.getUrl(args.storage_id);

    return { fileId, url, expires_at: expiresIn24Hours };
  },
});

// Clean up expired temporary files
export const cleanupExpiredFiles = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find expired files
    const allFiles = await ctx.db
      .query("files")
      .collect();
    
    const expiredFiles = allFiles.filter(
      file => file.expires_at && file.expires_at < now
    );

    let deletedCount = 0;
    let failedCount = 0;
    
    for (const file of expiredFiles) {
      // Delete from storage
      if (file.storage_id) {
        try {
          await ctx.storage.delete(file.storage_id);
        } catch (error) {
          console.error(`Failed to delete storage for file ${file._id}:`, error);
          failedCount++;
          continue;
        }
      }
      
      // Delete record
      await ctx.db.delete(file._id);
      deletedCount++;
    }

    console.log(`File cleanup completed: ${deletedCount} deleted, ${failedCount} failed`);
    
    return { 
      deleted: deletedCount,
      failed: failedCount,
    };
  },
});