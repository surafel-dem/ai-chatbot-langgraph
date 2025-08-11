# AI Chatbot Application Overview

This document describes the current application architecture, file structure, primary flows, environment, and usage. It reflects the current implementation in this repository, which adapts the Vercel AI Chatbot template to use Convex for persistence and Clerk for authentication.

## Tech Stack

- Next.js App Router (React Server Components, Server Actions)
- AI SDK v5 (streaming, tool calls, object generation)
- Clerk (authentication)
- Convex (database + backend functions)
- Tailwind CSS + shadcn/ui + Radix UI
- Bun (scripts, package manager)

## Directory Structure (frontend/)

```
app/
  (auth)/
    actions.ts
    api/
      auth/
        [...nextauth]/
        guest/
    login/[[...sign-in]]/page.tsx
    register/[[...sign-up]]/page.tsx
  (chat)/
    actions.ts
    api/
      chat/route.ts
      document/route.ts
      files/upload/route.ts
      history/route.ts
      suggestions/route.ts
      vote/route.ts
    chat/[id]/page.tsx
    layout.tsx
    page.tsx

components/
  ... UI and chat components (messages, editors, sidebar, artifacts, etc.)

convex/
  _generated/           # Convex generated API
  auth.ts               # Convex authentication binding
  auth.config.ts        # OIDC provider config (Clerk)
  schema.ts             # Convex schema (users, chats, messages, documents, votes, streams, files, etc.)
  users.ts              # User-related queries/mutations
  chats.ts              # Chat-related queries/mutations + stream tracking
  documents.ts          # Document/artifact + suggestions + votes logic
  files.ts, crons.ts, http.ts, README.md, ...

hooks/
  use-*.tsx             # Chat UI hooks and utilities

lib/
  ai/                   # Providers, prompts, tools, entitlements
  api-handler.ts        # API wrappers (withAuth/withOptionalAuth/withGuest)
  api-response.ts       # JSON/Errors helpers
  auth.ts               # Clerk helpers (server)
  constants.ts, utils.ts

tests/                  # Playwright E2E and route tests
```

## Key Application Flows

### Authentication and Middleware

- `middleware.ts` enforces route access:
  - Public: `/`, `/login`, `/register`, Clerk auth endpoints, `/ping`
  - Optional auth: `/api/chat`, `/api/vote`, `/api/document`
  - All else requires auth (`auth.protect()`)

### Convex Client Usage in API Routes

- `lib/api-handler.ts` provides:
  - `withAuth(handler)` → resolves Clerk user, creates Convex client with JWT (template `convex`), passes `{ convex, userId, request }`
  - `withOptionalAuth(handler)` → supports both authenticated and guest (unauthenticated) clients
  - `withGuest(handler)` → unauthenticated Convex client

### Chat Generation API

- `app/(chat)/api/chat/route.ts` handles POST chat requests:
  - Validates body with Zod (`schema.ts`)
  - Resolves user type (regular/guest)
  - Ensures or creates a Convex user (registered or guest)
  - Reads/sets a stable `guest_id` cookie for guests (HttpOnly, Secure, Lax, 30d)
  - Creates the chat if missing (with title via `generateTitleFromUserMessage`)
  - Saves the user message, starts a stream record, streams AI output using AI SDK
  - Tools available for non-reasoning model: `getWeather`, `createDocument`, `updateDocument`, `requestSuggestions`
  - Credits (feature-flagged):
    - Guests: a readable `anonymous-session` cookie tracks `remainingCredits` (default 10/day in prod). Each send deducts a base model cost (chat-model=1, reasoning=2). At 0, requests are blocked with a CTA to sign in. Cookie resets daily.
    - Registered users: unlimited for now. Convex reservation/finalization is scaffolded for future paid plans.
  - On finish, saves generated assistant messages and completes stream
  - DELETE supports chat deletion with ownership checks

### Documents and Suggestions APIs

- `app/(chat)/api/document/route.ts`:

  - GET: fetch document; if not published, checks ownership
  - POST: create or update document (auth required)
  - DELETE: delete document (auth + ownership)

- `app/(chat)/api/suggestions/route.ts`:
  - GET: fetch suggestions for a document (auth + ownership)

### History and Votes APIs

- `app/(chat)/api/history/route.ts`:

  - GET: fetch user chats (auth) with simple pagination placeholders

- `app/(chat)/api/vote/route.ts`:
  - PATCH: vote a message (auth + ownership)

### Audio & Uploads

- Uploads are disabled. `app/(chat)/api/files/upload/route.ts` responds `410 Gone` and is kept only as a placeholder.
- The message composer shows an Audio button (microphone) as a placeholder; recording is not yet implemented.

### AI Provider and Tools

- `lib/ai/providers.ts`:

  - In tests, uses mock models
  - In non-test, maps logical ids to OpenAI models (`gpt-4o`, `gpt-4o-mini`, `dall-e-3` images)

- Tools (`lib/ai/tools/*`):
  - `get-weather.ts`: calls Open-Meteo API
  - `create-document.ts`: emits transient UI data and persists a new document via `documentHandlersByArtifactKind`
  - `update-document.ts`: fetches document from Convex and applies handler-driven updates
  - `request-suggestions.ts`: streams structured edits and persists suggestions

#### Tool Costs (Credits)

- Defined in `lib/ai/tool-costs.ts`:
  - Base model cost: chat-model=1, chat-model-reasoning=2
  - Tool costs: `getWeather:1`, `createDocument:5`, `updateDocument:5`, `requestSuggestions:1`

### Specialists & Orchestrator (planned/rolling out)
- We are adding a specialist layer with an orchestrator that routes user intent (or Quick Selections) to Reliability Analysis (first), Running Cost, or Purchase Advice.
- Streaming emits AI Elements Task events for progress and a final report rendered with AI Elements Response.
- See `docs/ORCHESTRATOR_MIGRATION.md` and `new_feauture.md` for sequencing and architecture.

### Artifacts and Document Handlers

- `lib/artifacts/server.ts` bridges tool invocations to Convex mutations for `text`, `code`, `image`, and `sheet` kinds.

## Convex Schema (High-Level)

- `users`: clerk_id, is_guest, guest_id, counts, timestamps
- `chats`: custom `id` (UUID), `user_id`, title, visibility, counts
- `messages`: chat_id, user_id, role, content, parts, attachments, model
- `votes`: message_id, user_id, chat_id, is_upvoted
- `documents`: custom `id`, user_id, title, content, kind, version, is_published
- `suggestions`: document suggestions
- `files`: metadata + storage refs (app-level metadata)
- `streams`: active/completed stream tracking

See `convex/schema.ts` for exact field definitions and indices.

## Environment

- Required (examples):
  - `NEXT_PUBLIC_CONVEX_URL`
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
  - `OPENAI_API_KEY` (if using OpenAI provider)

## Scripts (Bun)

- `bun run dev` → runs Convex and Next.js in parallel
- `bun run build` → deploy Convex, build Next.js
- `bun run convex:deploy`, `bun run next:dev`, `bun run convex:dev`
- `bun run test` (unit), `bun run test:e2e` (Playwright)

## Testing

- E2E tests under `tests/e2e` cover chat flows, session/guest flows, and voting
- Route tests under `tests/routes` validate `/api/chat` behavior and streaming

## Security Considerations (Current)

- Ownership checks on all Convex mutations/queries
- Route-level auth via Clerk middleware and API wrappers
- Stable guest cookie implemented for guest flows (`guest_id`, HttpOnly, Secure, Lax, 30d)

Known limitations (to be addressed separately):

- Audio capture/transcription not yet implemented (UI placeholder only)

## Upstream Template Reference

This project originated from the Vercel AI Chatbot template and follows its patterns for streaming and tools. See the upstream reference for feature intent and parity notes: <https://github.com/vercel/ai-chatbot/tree/main>.
