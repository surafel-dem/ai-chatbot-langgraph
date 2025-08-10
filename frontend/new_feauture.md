### Reliability Analysis Agent – Implementation Plan

- Goals
  - Add an orchestrated “Reliability Analysis” specialist agent on top of current chat (Convex + Clerk + guest credits remain).
  - Trigger via Quick Selection or chat intent routing (orchestrator).
  - Stream step-by-step Tasks and render a final report artifact with sources.
  - Use AI Elements for Conversation, Response, Task, Actions UI.
  - Keep registered users unlimited for now; guests pay a higher fixed credit per run.

- References
  - AI Elements: Conversation, Response, Task, Actions: https://ai-sdk.dev/elements/components/conversation, https://ai-sdk.dev/elements/components/response, https://ai-sdk.dev/elements/components/task
  - Minimal deep-research orchestration patterns: https://github.com/FranciscoMoretti/ai-sdk-deep-research?tab=readme-ov-file
  - Base chat template streaming: https://github.com/vercel/ai-chatbot

- Architecture
  - Orchestrator (router):
    - If Quick Selection “Reliability Analysis” → start reliability run directly.
    - Else classify last chat message (rule-first, LLM fallback) → either normal chat or reliability.
    - Confirmation stage: normalize/confirm car make/model/year; handle ambiguity by proposing top candidates.
  - Specialist agent (reliability):
    - Steps: confirmCar → planQueries → fetch+summarize → extractIssues → scoreDimensions → draftReport → finalizeReport.
    - Tools: web search, fetch page, extract notes, aggregate+score, report writer.
    - Streaming: emit TaskStart/TaskUpdate/TaskFinish; FinalReport (markdown + scores + sources).

- Data model (Convex)
  - research_runs
    - id (string UUID), user_id (guests/registered), type: 'reliability', params: { make, model, year }, status: 'pending' | 'running' | 'done' | 'error', created_at, updated_at, linked_chat_message_id?
  - research_events
    - run_id, type: 'task-start' | 'task-update' | 'task-finish' | 'final-report', payload (JSON), created_at
  - Optional research_sources (if you want a table): run_id, title, url, excerpt, score
  - Queries/Mutations:
    - createRun, appendEvent, completeRun, getRun(+events), listRuns (ownership enforced via Clerk subject)

- API (Next.js routes)
  - Orchestrator: `app/(orchestrator)/api/route.ts`
    - Input: chatId, last user message, optional quickSelection
    - Output: { action: 'chat' } | { action: 'startRun', runType: 'reliability', params }
    - If starting run, create run row, optionally post a chat “handoff” message linking to run page
  - Reliability agent: `app/(research)/api/reliability/route.ts`
    - Input: runId, (car params when creating)
    - SSE stream (AI SDK): TaskStart/TaskUpdate/TaskFinish; FinalReport
    - Persist each event in Convex; on finish, save final report

- Prompts (prompt pack)
  - confirmCar: “Normalize/confirm make, model, year; if ambiguous, propose top 3 with differences; ask user to select one.”
  - planQueries: “Generate 5–8 reliability-focused queries (recalls, TSBs, common failures, long-term ownership, drivetrain issues, TCO) for {car}.”
  - extractIssues: “Summarize each source (bullets + short excerpt + URL).”
  - scoreDimensions: “Score 1–10 per dimension: engine/drivetrain, electrical, body/interior, recalls/TSBs, maintenance/TCO. Give 1-sentence justification with citations.”
  - finalizeReport: “Produce concise Markdown: Overview, Dimension Scores (with short justifications), Sources.”

- Streaming schema (client-facing; sent via SSE)
  - task-start: { id, title }
  - task-update: { id, items: Array<string | { type:'file' | 'text', text, file? }> }
  - task-finish: { id, summary }
  - final-report: { reportMarkdown, sources: [{title,url,excerpt}], scores: { engine, electrical, body, recalls, tco } }

- Frontend (UI/UX)
  - Quick Selections (chat page):
    - “Reliability Analysis” button: starts run and routes to run page
  - Reliability run page: `app/(research)/reliability/[runId]/page.tsx`
    - Left: Tasks (AI Elements Task/TaskTrigger/TaskContent/TaskItem) bound to streamed events
    - Right: Final Report (AI Elements Response for markdown; AI Elements Sources for citations)
    - If run is in confirm stage: small input/selection to choose exact car, then resume run
  - Chat:
    - Wrap messages with AI Elements Conversation; render each text part with Response (streaming markdown)

- Library structure (new)
  - `lib/ai/tools/reliability/`
    - `prompts.ts`
    - `reliability-agent.ts` (pipeline)
    - `steps/web-search.ts`, `steps/fetch-summarize.ts`, `steps/extract-issues.ts`, `steps/score.ts`
  - `lib/orchestrator/route-reliability.ts` (classification + normalization helpers)

- Credits and limits
  - Guests: deduct e.g., 5 credits on run start; block at 0 (reuse cookie credits).
  - Registered: unlimited for now (reservation disabled); future: enable reservation/finalization with per-step or per-run costs.

- Feature flags and config
  - `lib/feature-flags.ts`: `reliability: true`
  - `.env.local`: search provider key (e.g., TAVILY_API_KEY); OPENAI_API_KEY etc.
  - If REDIS_URL present, enable resumable stream optimization; otherwise return normal SSE (follow minimal deep-research fallback).

- Telemetry and logging
  - Log step boundaries (task-start/finish) and summary counts (sources found, tokens, timing).
  - Keep PII out of logs; gate verbose logs to development.

- Rollout
  - Phase 1 (scaffold): Convex tables, routes skeletons, Task UI streaming with mocked steps.
  - Phase 2 (agent): wire prompts + real web search + fetch/summarize + scoring + final report; stream events; persist.
  - Phase 3 (orchestrator): chat integration + confirmation loop + quick selections; handoff message.
  - Phase 4 (polish): credits gating for guests at run start, sources rendering, resume after refresh, tests.

- Tests (acceptance)
  - Start from Quick Selection → confirm car → progress Tasks appear → final report rendered with sources.
  - Refresh mid-run → page resumes and replays from Convex events.
  - Guests: credits decremented on run start; blocked at 0 with CTA.
  - Registered: no block; credits unchanged for now.

- Documentation
  - Add “Specialists” section in README/docs:
    - How to start Reliability Analysis
    - Streaming Tasks UI (AI Elements Task) + final report (Response/Sources)
    - Costs and limits (guests vs registered)
    - How to add new specialist packs by swapping prompt bundles

- Actionable next tasks
  - Add Convex: `research_runs`, `research_events`, mutations/queries
  - Implement `app/(research)/api/reliability/route.ts` streaming pipeline with mock data
  - Build `app/(research)/reliability/[runId]/page.tsx` with AI Elements Task/Response
  - Hook Quick Selection button to create run and navigate
  - Add orchestrator route with basic rules; confirmation UI on run page
  - Integrate real web search provider and finalize prompts
  - Credits: deduct for guests on run start
  - Tests + docs update