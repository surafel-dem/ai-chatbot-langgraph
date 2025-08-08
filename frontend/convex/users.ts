import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get the current authenticated user
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();
  }
});

/**
 * Ensure a user exists in the database, creating if necessary
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();
      
    if (existingUser) {
      // Update last seen
      await ctx.db.patch(existingUser._id, {
        last_seen_at: Date.now(),
        updated_at: Date.now(),
      });
      return existingUser._id;
    }
    
    // Create new user
    const now = Date.now();
    return await ctx.db.insert("users", {
      clerk_id: identity.subject,
      email: identity.email,
      name: identity.name,
      image_url: identity.pictureUrl,
      is_guest: false,
      message_count: 0,
      chat_count: 0,
      document_count: 0,
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    });
  },
});

/**
 * Create a guest user
 */
export const createGuestUser = mutation({
  args: {
    guest_id: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if guest already exists
    const existingGuest = await ctx.db
      .query("users")
      .withIndex("by_guest_id", (q) => q.eq("guest_id", args.guest_id))
      .first();
      
    if (existingGuest) {
      await ctx.db.patch(existingGuest._id, {
        last_seen_at: now,
      });
      return existingGuest._id;
    }
    
    // Create new guest user
    const userId = await ctx.db.insert("users", {
      guest_id: args.guest_id,
      is_guest: true,
      message_count: 0,
      chat_count: 0,
      document_count: 0,
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    });
    
    // Create guest session for cleanup
    await ctx.db.insert("guest_sessions", {
      guest_id: args.guest_id,
      session_id: `session_${now}_${args.guest_id}`,
      last_activity_at: now,
      message_count: 0,
      marked_for_deletion: false,
      created_at: now,
      expires_at: now + (24 * 60 * 60 * 1000), // 24 hours
    });
    
    return userId;
  },
});

/**
 * Get user by ID with ownership check
 */
export const getUserById = query({
  args: { 
    user_id: v.id("users") 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const user = await ctx.db.get(args.user_id);
    if (!user) return null;
    
    // Only allow users to access their own data
    if (user.clerk_id !== identity.subject) {
      return null;
    }
    
    return user;
  },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();
      
    if (!user) {
      throw new Error("User not found");
    }
    
    const updates: any = { 
      updated_at: Date.now() 
    };
    
    if (args.name !== undefined) updates.name = args.name;
    if (args.image_url !== undefined) updates.image_url = args.image_url;
    
    await ctx.db.patch(user._id, updates);
    
    return { success: true };
  },
});

/**
 * Get user statistics
 */
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();
      
    if (!user) return null;
    
    return {
      user,
      stats: {
        chats: user.chat_count,
        messages: user.message_count,
        documents: user.document_count,
      },
    };
  },
});