## AI SDK Deep Research (Minimal Example)

https://github.com/user-attachments/assets/82f5dab6-2408-4165-8aa3-124a00032a50

A minimal, end‑to‑end deep‑research agent implemented with AI SDK and Next.js. It mirrors the architecture of Open Deep Research while replacing LangChain/Graph with AI SDK’s streaming, tool calling, and structured outputs. Includes a small UI that surfaces intermediate research updates in real time.

- **Architecture reference**: inspired by Open Deep Research [link](https://github.com/langchain-ai/open_deep_research)
- **Prod‑ready example**: see `sparka` [link](https://github.com/FranciscoMoretti/sparka)

### What you get

- **Deep research loop** with planning, web search, iterative supervision, and final report generation
- **AI SDK tools + streaming** wired into a Next.js route for SSR and resumable streams
- **UI components** that render intermediate updates (queries, results, thoughts, writing) in the chat

## Architecture from Open Deep Research

<img width="1388" height="298" alt="deep-research-architecture" src="https://github.com/user-attachments/assets/ae2568b1-8efe-4cbb-af55-b3db4927e465" />


## Quickstart

### Requirements

- Node.js 20+
- An OpenAI API key
- A Tavily API key
- Optional Redis for resumable, persistent SSE streams

### Environment

Create `.env.local` at the repo root:

```bash
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
# optional, enables resumable streams + persistence
REDIS_URL=redis://default:password@host:port
```

Notes:
- **OPENAI_API_KEY** is required to run the language model.
- **TAVILY_API_KEY** is required for web search (default provider).
- **REDIS_URL** is optional; without it, resumable streaming is disabled gracefully but the app still works.

****### Install & run

```bash
pnpm i # or npm i / yarn
pnpm dev # or npm run dev / yarn dev
```

Open `http://localhost:3000` and ask a research question.

## How it works

### High level

- API route `POST` `app/api/chat/route.ts` creates a streaming AI SDK session (`streamText`) with the deep‑research tool attached and forwards server‑sent events to the client.
- The deep‑research tool orchestrates:
  - Clarification (if enabled)
  - Research brief creation
  - A supervisor loop that dispatches web searches and aggregates notes
  - Final report generation (structured output)
- The UI subscribes to streamed events and renders intermediate updates and the final report artifact.

### Relevant files

- **API**
  - `app/api/chat/route.ts`: wires up AI SDK `streamText`, tools, stop conditions, and SSE/resumable streams (Redis optional). If `REDIS_URL` is missing, it logs and returns a normal SSE stream.

- **Deep research agent**
  - `lib/ai/tools/deep-research/deep-researcher.ts`: end‑to‑end workflow
    - `runDeepResearcher(...)`: orchestrates the whole flow
    - `ResearcherAgent` and `SupervisorAgent`: research loop with tool execution
    - `writeResearchBrief(...)` and final report generation
  - `lib/ai/tools/deep-research/configuration.ts`: config schema + `loadConfigFromEnv()` overrides
  - `lib/ai/tools/steps/web-search.ts`: web search step using Tavily (via `TAVILY_API_KEY`)

- **Frontend (intermediate updates)**
  - `components/message-annotations.tsx` → `ReasonSearchResearchProgress`
  - `components/research-tasks.tsx`, `components/research-task.tsx`: render queries/results/thoughts
  - `components/artifact.tsx`: renders the final report artifact as it streams/finishes
  - `app/chat/[chatId]/*`: chat UI and message rendering

## Configuration knobs (optional)

Most users only need the three env vars below. Advanced tuning lives in `lib/ai/tools/deep-research/configuration.ts` (model ids, iteration caps, search provider selection, etc.).

## Environment variables

- **OPENAI_API_KEY**: required
- **TAVILY_API_KEY**: required (default search provider)
- **REDIS_URL**: optional (enables resumable streams/persistence)

## Scripts

```bash
pnpm dev      # Next.js dev server
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Lint
pnpm test:types
```

## Differences vs Open Deep Research

- **AI SDK first**: Uses AI SDK `streamText`, tool calling, type safety, structured outputs, and telemetry instead of LangChain/LangGraph
- **Lightweight**: Minimal surface area; fewer deps; drop‑in Next.js route
- **Streaming‑native**: UI wired to intermediate updates and artifacts via SSE; optional Redis for resumable streams

## References

- Open Deep Research (reference architecture): [link](https://github.com/langchain-ai/open_deep_research)
- Production‑grade variant (with more features, infra, and polish): [link](https://github.com/FranciscoMoretti/sparka)
