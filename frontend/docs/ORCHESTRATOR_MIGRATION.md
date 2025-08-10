# Orchestrated Agents Migration — Initial State and Implementation Summary

This document records the state of the application before introducing the orchestrated agent workflow and summarizes the changes delivered across four phases. It reflects and condenses the plan in `frontend/new_feauture.md` into a repo‑aware summary.

## 1) Initial project setup (before phases)

- Framework and runtime
  - Next.js App Router (server + client components)
  - Vercel AI SDK (`useChat`, `streamText`, UI Data Stream)
  - Tailwind + existing chat UI (greeting, 4 suggestion cards, composer, history sidebar, artifact overlay)
- Backend & persistence
  - Convex (users, chats, messages, files, documents, etc.)
  - Clerk for auth; `getAuthUser` and middleware in place
- Chat behavior
  - Single‑model “chat only” flow: API route directly called `streamText` and streamed to UI
  - Tools: `getWeather`, `createDocument`, `updateDocument`, `requestSuggestions` (integrated with artifacts)
- Guest/credits (pre‑existing work)
  - Guest credit banner via client‑readable cookie and plans for DB credits on Clerk users
  - Feature flags present: `credits: true`

## 2) Migration goals (from new_feauture.md)

- Orchestrated multi‑agent workflow for car analysis
  - Planner: normalize make/model/year and ask up to 2 clarifying questions
  - Specialist: one of Purchase Advice, Running Cost, Reliability
- Keep UI and persistence intact
- Stream via AI SDK UI Data Stream parts; abort‑safe; add Convex telemetry for runs/steps/tools/sources

## 3) What we added — high level

- Orchestrator layer (router → planner → specialists) using only Vercel AI SDK
- Convex telemetry (`runs`, `steps`, `tool_calls`, `sources`) and mutations
- Minimal UI scaffolding that preserves current layout
- Tools with Zod schemas and safe fallbacks: `webSearch`, `priceLookup`, `specLookup`
- Three specialists (Purchase Advice, Running Cost, Reliability). Each asks for missing car details once then exits so the composer is free. No hardcoded defaults.

## 4) Four phases — delivered changes

### Phase 1 — Feature flag + Convex telemetry
- Files: `lib/feature-flags.ts`, `convex/schema.ts`, `convex/{runs.ts,steps.ts,tool_calls.ts,sources.ts}`
- Outcome: feature‑gated roll‑out; durable telemetry for each run/step/tool/source

### Phase 2 — Orchestrator core + tool stubs
- Files: `lib/ai/model.ts`, `lib/ai/orchestrator/{types.ts,emit.ts,state.ts,budget.ts,router.ts,planner.ts,index.ts}`
- Tools: `lib/ai/tools/{webSearch.ts,priceLookup.ts,specLookup.ts}`
- Notes: router uses an LLM tool call, planner streams concise normalizations; `emit` writes AI SDK UI parts; router has a 2s fallback to `plan` and honors a `[orchestrator]` UI tag

### Phase 3 — API route integration (behind flag)
- `app/(chat)/api/chat/route.ts`: preserved auth/DB logic; replaced direct `streamText` with `runOrchestrator` under the feature flag; added Convex run start/end

### Phase 4 — UI wiring (non‑disruptive)
- Data stream wiring: `data-textDelta` and `data-part` events handled
- Components: `components/orchestrator/{assistant-stream,sources-panel}.tsx` (progress/planner badges hidden by default)
- Store: `stores/orchestrator-store.ts` (planner state, sources, citations)
- Landing micro‑tweaks: specialist‑linked quick prompts (no hardcoded car text), greeting subtitle, `PlannerHint` hides once a specialist is active
- Artifact overlay suppressed during orchestrator runs to avoid empty panel space

## 5) Specialists

- Purchase Advice
  - Executes `specLookup`, `priceLookup`, `webSearch`; streams concise sections; robust fallback parsing of user input
  - Emits `source-url` items for citations
- Running Cost & Reliability
  - Implemented; greet/clarify once if details missing; then analyze

## 6) Stream contract used

- `data-textDelta` for live text (non‑transient so deltas compose smoothly)
- `data-part`: `tool-input-available`, `tool-output-available`, `source-url`, `finish-step`, `planner-state`
- Event shape aligned to AI SDK expectations (fixes earlier 500s)

## 7) Behavior and guardrails

- Router + intent
  - First message with explicit intent (from quick prompts) routes directly to that specialist
  - Otherwise router may pick `plan`; planner emits `planner-state` and ends; next user reply goes to a specialist
  - One step per request; end run after each step
- Abort safety: `abortSignal` passed to all streams; streaming never blocked by DB writes
- Credits and auth: pre‑existing banners and Clerk flows preserved
- Input readiness: stream closes at end of step so the composer is active immediately

## 8) Manual test

1. Hard refresh; ensure `agentsOrchestrator: true`
2. Click a specialist prompt (e.g., “Running cost analysis”)
3. Expect: immediate short ask if details missing; input is ready; after reply, specialist streams analysis with sources
4. Verify Convex `runs` and `steps` rows were created

## 9) Follow‑ups

- Persist last `planner-state` in Convex and pass to specialists automatically
- Emit real citations from tools and link `[1]`, `[2]` inline
- Optional: resumable streams
- Replace `priceLookup`/`specLookup` stubs with real providers
- Add Playwright tests for event order and router selection

## 10) File map (additions)

- `frontend/lib/ai/model.ts`
- `frontend/lib/ai/orchestrator/*`
- `frontend/lib/ai/tools/{webSearch.ts,priceLookup.ts,specLookup.ts}`
- `frontend/lib/ai/agents/purchase.ts`
- `frontend/stores/orchestrator-store.ts`
- `frontend/components/orchestrator/*`
- `frontend/app/(chat)/api/chat/route.ts` (edited)
- `frontend/convex/{runs.ts,steps.ts,tool_calls.ts,sources.ts}` (new) + `schema.ts` (edited)

---

For full design details see `frontend/new_feauture.md`.
