# Database and Authentication (Convex + Clerk)

This document consolidates all database and authentication details for the app. It supersedes older Convex/Clerk markdowns under `frontend/convex/convex_docs/*`.

## Overview

- Authentication: Clerk (JWT template `convex`) with Next.js middleware enforcement
- Persistence: Convex schema for users, chats, messages, documents, suggestions, votes, files, streams
- Access control: Ownership checks at Convex layer using `ctx.auth.getUserIdentity()`
- Guests: Supported with unauthenticated Convex client mapped to guest records in `users`

## Clerk Integration

- Middleware: `frontend/middleware.ts` defines public/optional/protected routes and calls `auth.protect()` for the rest
- Server helpers: `frontend/lib/convex-client.ts` uses Clerk `getToken({ template: 'convex' })` and sets auth on `ConvexHttpClient`
- Convex OIDC: `frontend/convex/auth.config.ts` points to Clerk issuer (`CLERK_ISSUER_URL`) and uses `applicationID: 'convex'`
- Convex auth binding: `frontend/convex/auth.ts` exports `{ auth, signIn, signOut, store }`, with providers now empty (OIDC-only via Clerk).

Env vars (examples):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
CLERK_ISSUER_URL=https://<your-app>.clerk.accounts.dev
OPENAI_API_KEY=sk-...
```

## API Wrappers

- `withAuth(handler)`
  - Resolves Clerk user id
  - Creates Convex client with JWT and passes `{ convex, userId, request }`
  - Returns 401 if unauthenticated
- `withOptionalAuth(handler)`
  - Authenticated users get JWT-authenticated Convex client; otherwise guest client
  - Passes `{ convex, userId | null, request }`
  - For guests, a stable `guest_id` cookie is read or created (HttpOnly, Secure, Lax, 30d)
- `withGuest(handler)`
  - Uses unauthenticated Convex client

See `frontend/lib/api-handler.ts` for details.

## Convex Schema (Current)

See `frontend/convex/schema.ts` for full definitions and indices.

- `users`
  - `clerk_id?`, `email?`, `name?`, `image_url?`, `is_guest`, `guest_id?`, usage counters, timestamps
  - Indices: `by_clerk_id`, `by_email`, `by_guest_id`
- `chats`
  - `id` (UUID), `user_id`, `title`, `visibility`, counters, timestamps
  - Indices: `by_custom_id`, `by_user`, `by_visibility`, `by_updated`
- `messages`
  - `chat_id`, `user_id`, `role`, `content`, `parts?`, `attachments?`, `model?`, timestamps
  - Indices: `by_chat`, `by_user`, `by_created`
- `votes`
  - `message_id`, `user_id`, `chat_id`, `is_upvoted`, timestamp
  - Indices: `by_message`, `by_user`, `by_chat`, `unique_vote`
- `documents`
  - `id` (UUID), `user_id`, `chat_id?`, `message_id?`, `title`, `content?`, `kind`, `language?`, `version`, `is_published`, timestamps
  - Indices: `by_custom_id`, `by_user`, `by_chat`, `by_kind`, `by_created`
- `suggestions`
  - `document_id`, `user_id`, `original_text`, `suggested_text`, `description?`, `is_resolved`, `resolved_by?`, `resolved_at?`, timestamp
  - Indices: `by_document`, `by_user`, `by_resolved`
- `files`
  - ownership, `storage_id`, `filename`, `mime_type`, `size`, `status`, `error?`, `url?`, timestamps
  - Indices: `by_user`, `by_chat`, `by_message`, `by_storage_id`, `by_status`
- `streams`
  - `chat_id`, `user_id`, `stream_id`, `status`, `partial_message?`, `started_at`, `completed_at?`
  - Indices: `by_chat`, `by_user`, `by_stream_id`, `by_status`

## Convex Functions

- Users (`frontend/convex/users.ts`)
  - `getCurrentUser` (query), `ensureUser` (mutation), `createGuestUser` (mutation), `getUserById` (query), `updateProfile`, `getUserStats`
- Chats (`frontend/convex/chats.ts`)
  - `createChat`, `getUserChats`, `getUserChatsById`, `getChatById`, `updateChatTitle`, `deleteChat`
  - `sendMessage`, `getChatMessagesById`, `startStream`, `completeStream`, `getActiveStreams`
- Documents (`frontend/convex/documents.ts`)
  - `createDocument`, `getDocumentById`, `getUserDocuments`, `updateDocument`, `deleteDocument`
  - `getDocument` (alias of `getDocumentById` for compatibility)
  - `getDocumentSuggestions` (list suggestions for a document)
  - `createSuggestion`, `voteMessage`, `getChatVoteStats`

## Access Control

- All ownership-guarded operations verify Clerk identity with `ctx.auth.getUserIdentity()` and match the `users` table record `_id`.
- Private resources require ownership; published documents can be accessed by guests.

## Guests

- Guest users are created and updated with `createGuestUser(guest_id)`.
- A stable `guest_id` is now persisted in an HttpOnly cookie to enable consistent rate limiting and ownership across requests.

## Security Notes

- Removed verbose auth/session logs in production (see `frontend/lib/auth.ts`).
- Uploads are disabled; audio placeholder is shown in UI.

## References

- Upstream template: <https://github.com/vercel/ai-chatbot/tree/main>
- Clerk + Convex: OIDC config via `auth.config.ts` and Clerk JWT template `convex`
