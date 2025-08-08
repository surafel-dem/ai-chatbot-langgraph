import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  
  // Users table for both registered and guest users
  users: defineTable({
    // Authentication
    clerk_id: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image_url: v.optional(v.string()),
    
    // Guest user support
    is_guest: v.boolean(),
    guest_id: v.optional(v.string()),
    
    // User stats
    message_count: v.number(),
    chat_count: v.number(),
    document_count: v.number(),
    
    // Timestamps
    created_at: v.number(),
    updated_at: v.number(),
    last_seen_at: v.number(),
  })
    .index("by_clerk_id", ["clerk_id"])
    .index("by_email", ["email"])
    .index("by_guest_id", ["guest_id"]),

  // Chat sessions
  chats: defineTable({
    id: v.string(), // Custom UUID for compatibility
    user_id: v.id("users"),
    title: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    
    // Metadata
    message_count: v.number(),
    last_message_at: v.optional(v.number()),
    
    // Timestamps
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_custom_id", ["id"])
    .index("by_user", ["user_id"])
    .index("by_visibility", ["visibility"])
    .index("by_updated", ["updated_at"]),

  // Chat messages
  messages: defineTable({
    ui_id: v.optional(v.string()),
    chat_id: v.string(),
    user_id: v.id("users"),
    
    // Message content
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    
    // AI SDK message parts support
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
    
    // Attachments
    attachments: v.optional(v.array(v.object({
      file_id: v.optional(v.id("files")),
      url: v.string(),
      name: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
    
    // Metadata
    model: v.optional(v.string()),
    
    // Timestamps
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_chat", ["chat_id"])
    .index("by_ui_id", ["ui_id"]) 
    .index("by_user", ["user_id"])
    .index("by_created", ["created_at"]),

  // Message votes
  votes: defineTable({
    message_id: v.id("messages"),
    user_id: v.id("users"),
    chat_id: v.string(),
    is_upvoted: v.boolean(),
    
    // Timestamps
    created_at: v.number(),
  })
    .index("by_message", ["message_id"])
    .index("by_user", ["user_id"])
    .index("by_chat", ["chat_id"])
    .index("unique_vote", ["message_id", "user_id"]),

  // Documents (artifacts)
  documents: defineTable({
    id: v.string(), // Custom UUID for compatibility
    user_id: v.id("users"),
    chat_id: v.optional(v.string()),
    message_id: v.optional(v.id("messages")),
    
    // Document content
    title: v.string(),
    content: v.optional(v.string()),
    kind: v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("image"),
      v.literal("sheet")
    ),
    
    // For code documents
    language: v.optional(v.string()),
    
    // Metadata
    version: v.number(),
    is_published: v.boolean(),
    
    // Timestamps
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_custom_id", ["id"])
    .index("by_user", ["user_id"])
    .index("by_chat", ["chat_id"])
    .index("by_kind", ["kind"])
    .index("by_created", ["created_at"]),

  // Document suggestions
  suggestions: defineTable({
    document_id: v.string(),
    user_id: v.id("users"),
    
    // Suggestion content
    original_text: v.string(),
    suggested_text: v.string(),
    description: v.optional(v.string()),
    
    // Status
    is_resolved: v.boolean(),
    resolved_by: v.optional(v.id("users")),
    resolved_at: v.optional(v.number()),
    
    // Timestamps
    created_at: v.number(),
  })
    .index("by_document", ["document_id"])
    .index("by_user", ["user_id"])
    .index("by_resolved", ["is_resolved"]),

  // File storage
  files: defineTable({
    // Ownership
    user_id: v.id("users"),
    chat_id: v.optional(v.id("chats")),
    message_id: v.optional(v.id("messages")),
    
    // Storage reference
    storage_id: v.string(),
    
    // File metadata
    filename: v.string(),
    mime_type: v.string(),
    size: v.number(),
    
    // Processing status
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    
    // URLs
    url: v.optional(v.string()),
    
    // Timestamps
    created_at: v.number(),
    expires_at: v.optional(v.number()),
  })
    .index("by_user", ["user_id"])
    .index("by_chat", ["chat_id"])
    .index("by_message", ["message_id"])
    .index("by_storage_id", ["storage_id"])
    .index("by_status", ["status"]),

  // Guest sessions for cleanup
  guest_sessions: defineTable({
    guest_id: v.string(),
    session_id: v.string(),
    
    // Activity tracking
    last_activity_at: v.number(),
    message_count: v.number(),
    
    // Cleanup flag
    marked_for_deletion: v.boolean(),
    
    // Timestamps
    created_at: v.number(),
    expires_at: v.number(),
  })
    .index("by_guest_id", ["guest_id"])
    .index("by_session_id", ["session_id"])
    .index("by_expires", ["expires_at"]),

  // Active streaming sessions
  streams: defineTable({
    chat_id: v.string(),
    user_id: v.id("users"),
    
    // Stream metadata
    stream_id: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("failed")
    ),
    
    // Partial message being streamed
    partial_message: v.optional(v.string()),
    
    // Timestamps
    started_at: v.number(),
    completed_at: v.optional(v.number()),
  })
    .index("by_chat", ["chat_id"])
    .index("by_user", ["user_id"])
    .index("by_stream_id", ["stream_id"])
    .index("by_status", ["status"]),
});