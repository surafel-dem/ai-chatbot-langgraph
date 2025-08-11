### Reliability Analysis orchestration: concrete breakdown (using your prompt pack)

- Orchestrator (router)
  - Entrypoints:
    - Quick Selection: Reliability Analysis → start run.
    - Chat: classify last user message; if “reliability” → start run; else normal chat.
  - States: idle → confirmCar → research → report → done. Persist state in `research_runs.status`.
  - Credits:
    - Guests: deduct 5 credits at run start; block at 0.
    - Registered: no cap (future: paid credits).

- Specialist agent (Reliability) as 4 sub‑agents (mapped from RELIABILITY_ANALYSIS_INSTR)
  - CarConfirmer
    - Goal: normalize/confirm {year, make, model} (and optional preferences).
    - If ambiguous, return top 3 candidates to user → await selection → resume.
  - ProblemFinder
    - Goal: 3–5 common problems with symptoms, severity (Major/Minor), rough repair complexity/cost if surfaced. Use Ireland/UK bias.
    - Queries (from your prompt): “{YMM} common problems Ireland/UK”, “engine problems”, “transmission faults”, “electrical issues”, etc.
  - RecallFinder
    - Goal: official recalls (RSA.ie, GOV.UK DVSA) with issue + production dates/VIN ranges if available; advise VIN check.
  - MaintenanceAdvisor
    - Goal: 2–3 key maintenance tips; expensive routine items; longevity notes; bias to YMM‑specific.
  - Synthesizer
    - Goal: merge all; compute dimension scores {engine/drivetrain, electrical, body/interior, recalls/TSBs, maintenance/TCO}; write final report Markdown with inline [n] citations and numbered Sources.

- Prompts (split from your RELIABILITY_ANALYSIS_INSTR)
  - confirmCarPrompt: extract/normalize YMM + preferences; if ambiguous, propose top 3; ask user to pick.
  - problemsPrompt: ProblemFinder with the provided query list and source targets; output schema below.
  - recallsPrompt: RecallFinder for RSA/DVSA; output schema below.
  - maintenancePrompt: maintenance & longevity; output schema below.
  - synthPrompt: apply <output_format>, <report_format>, <document_structure>, <style_guide>, <citations>; produce final Markdown + scores + sources.

- Output JSON schemas (tool/object outputs)
  - problems.json
    - problems: Array<{ title, severity: 'Major'|'Minor', symptoms: string[], notes?: string, citations: string[] }>
  - recalls.json
    - recalls: Array<{ title, issue, dates?: string, vinRange?: string, citations: string[] }>
  - maintenance.json
    - tips: Array<{ tip: string, why: string, citations?: string[] }>
    - expensiveItems?: Array<{ item: string, when: string, approxCost?: string }>
  - final.json
    - reportMarkdown: string
    - scores: { engine: number, electrical: number, body: number, recalls: number, tco: number }
    - sources: Array<{ id: number, title: string, url: string, excerpt?: string }>
    - warnings?: string[]

- Streaming to AI Elements
  - SSE events:
    - task-start { id, title }
    - task-update { id, items: Array<string|{type:'file'|'text',text,file?}> } → map to `<TaskItem/>`
    - task-finish { id, summary }
    - final-report { reportMarkdown, scores, sources[] } → render with `<Response/>` + Sources.
  - Tasks UI: AI Elements Task (install once) [Task docs](https://ai-sdk.dev/elements/components/task).
  - Final Markdown: AI Elements Response (streaming‑optimized markdown) [Response docs](https://ai-sdk.dev/elements/components/response).
  - Conversation: wrap chat list with AI Elements Conversation (auto‑scroll) [Conversation docs](https://ai-sdk.dev/elements/components/conversation).

- API routes
  - Orchestrator: `app/(orchestrator)/api/route.ts`
    - Input: { chatId?, quickSelection?, lastUserText? }
    - Output: { action:'startRun', type:'reliability', params:{car, preferences?} } | { action:'chat' }
  - Reliability stream: `app/(research)/api/reliability/route.ts`
    - create run if needed; emit SSE:
      1) task-start confirmCar → (if ambiguous) return choices; wait user selection; resume
      2) task-start problems → stream task-update bullets per source cluster
      3) task-start recalls → stream task-update bullet list
      4) task-start maintenance → stream task-update list
      5) task-start synthesis → task-finish with summary
      6) final-report with reportMarkdown/scores/sources
    - Persist each event in Convex.

- Convex schema additions
  - `research_runs`: { id, user_id, type:'reliability', params:{car, preferences?}, status, linked_chat_message_id?, created_at, updated_at }
  - `research_events`: { run_id, type, payload, created_at }
  - Queries: getRun(run_id), listRuns(type?), getRunEvents(run_id)
  - Mutations: createRun(params), appendEvent(run_id,type,payload), completeRun(run_id)

- UI
  - Quick Selections under chat input (Actions): Reliability Analysis → create run + navigate to `/(research)/reliability/[runId]`.
  - Reliability page layout:
    - Left: Task timeline from streamed events.
    - Right: `<Response>` for final Markdown; Sources list; optional scores badges.
  - Chat handoff message: “Started Reliability Analysis for {YMM} → View Progress”.

- Credits & limits (current)
  - Guests: deduct 5 credits when run starts; banner + block at 0.
  - Registered: unlimited (reservation disabled for now); future: enable reservation/finalization per run.

- Rollout order
  1) Convex: runs/events tables + CRUD.
  2) Reliability API route streaming (mock steps → then real web search/fetch/summarize).
  3) Reliability page with AI Elements Task/Response + streaming wire‑up.
  4) Orchestrator route + Quick Selection + chat handoff.
  5) Credits deduction on run start for guests; docs/tests.

References
- Deep‑research streaming and orchestration ideas: [ai-sdk-deep-research](https://github.com/FranciscoMoretti/ai-sdk-deep-research?tab=readme-ov-file)
- AI Elements components (Task/Response/Conversation): [Task](https://ai-sdk.dev/elements/components/task), [Response](https://ai-sdk.dev/elements/components/response), [Conversation](https://ai-sdk.dev/elements/components/conversation)