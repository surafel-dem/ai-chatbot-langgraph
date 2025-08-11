Orchestrator Migration Plan (Chat → Specialists)
Goals

Keep chat flows intact (Convex persistence, Clerk auth, guest credits)
Add specialists (Reliability first; Running Cost, Purchase Advice next)
Orchestrator routes chat/quick selections to specialist runs
Stream progress with AI Elements Task; final report with AI Elements Response
Data model (Convex)
research_runs: { id, user_id, type: 'reliability'|'running'|'purchase', params { car, preferences? }, status, linked_chat_message_id?, created_at, updated_at }
research_events: { run_id, type: 'task-start'|'task-update'|'task-finish'|'final-report', payload, created_at }
Credits
Guests: deduct fixed cost (e.g., 5) at run start; CTA at 0
Registered: unlimited initially; future enable reservation/finalization
Orchestrator
Entry: Quick Selection → direct; Chat → classifier (rule-first, LLM fallback)
States: idle → confirmCar → research (problems/recalls/maintenance) → synthesis → final report → done
SSE: task-start, task-update, task-finish, final-report
Reliability specialist
Sub‑agents: CarConfirmer, ProblemFinder, RecallFinder, MaintenanceAdvisor, Synthesizer
Prompts: derived from your RELIABILITY_ANALYSIS_INSTR
API routes
(orchestrator)/api/route.ts → { action:'chat' | 'startRun' }
(research)/api/reliability/route.ts → SSE streaming + Convex persistence, AbortSignal-aware
UI/UX
Quick Selections; Reliability page with AI Elements Task/Response; chat handoff message
Sequencing
1) Convex tables
2) Reliability streaming (mock→real)
3) Reliability page UI wired to SSE
4) Orchestrator + Quick Selections + handoff
5) Credits + docs/tests
Testing
Start run → confirm car → watch tasks → final report; resume after refresh; guest credits deducted
Notes
Install Conversation/Response/Task/Actions from AI Elements; don’t break existing chat save logic