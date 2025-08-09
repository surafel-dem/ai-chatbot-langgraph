

# Orchestrated AI Agent Migration (Next.js + Vercel AI SDK + Convex + Clerk)

## Context

We have an existing repo based on **vercel/ai-chatbot** with **Convex** (persistence) and **Clerk** (auth). Right now, it’s “chat only.” We want to introduce an **orchestrated, multi-agent** workflow for a **car analysis** product:

* Planner stage: normalize/confirm the user’s car (make, model, year) and/or suggest matches.
* Specialist stage: run **one** of three analyses (Purchase Advice, Running Cost, Reliability) with streaming + inline citations.
* Keep **Vercel AI SDK** front-end (`useChat`) unchanged; the backend must emit the **AI SDK UI Data Stream** parts.
* Keep Clerk + Convex. Add Convex tables for run/step/tool telemetry and sources.

You will create a PR with the **exact file structure and code below**. Be precise. Don’t refactor anything beyond what’s specified.

---

## Golden Rules (don’t break these)

1. **No framework change.** Stay with **Next.js + Vercel AI SDK**. No LangGraph/CrewAI here.
2. **Keep `useChat`** in the UI. The backend must stream **AI SDK UI Data Stream** parts.
3. **Add, don’t mangle.** Add new files/folders. Only touch the chat API route to call the orchestrator.
4. **Type-safe tools.** All tools must use **Zod** for inputs. Sanitize external calls.
5. **Abort-safe.** Respect `AbortSignal` everywhere.
6. **Convex everywhere.** Persist run/step/tool/source telemetry. Don’t block streaming on DB writes.

---

## Repo‑aware refinements (must read before implementing)

These updates align the plan with the current codebase (Next.js 15 + AI SDK + Convex + Clerk) and UI we intend to keep (greeting, suggestions grid, composer, history sidebar, artifacts).

### Feature flags

- `lib/feature-flags.ts`
  - `agentsOrchestrator: true` (new)
  - `credits: true` (already present)

### Stream contract (UI data parts)

Agents MUST emit only these parts so the existing stream fan‑in remains simple:

- `text-delta` (live text)
- `tool-input-available`, `tool-output-available`
- `source-url` (url, title?)
- `finish-step`
- `planner-state` (new, JSON): `{ selectedCar: { make, model, year, trim?, engine? } }`

Error policy: specialists should emit narrative even if a tool fails (emit a `tool-output-available` error payload) and continue; only stop on `AbortSignal`.

### Usage/budget accounting

- Capture AI SDK usage per step and patch both:
  - `steps.token_in`, `steps.token_out`
  - accumulate into `runs.token_in`, `runs.token_out`
- Keep `MAX_STEPS` (default 8) and per‑tool timeouts (default 12s) with a tiny retry helper; wire into agents.

### Model adapter

- Add `/frontend/lib/ai/model.ts`:
  ```ts
  import { myProvider } from '@/lib/ai/providers';
  export const getModel = (selected?: string) =>
    (myProvider as any).languageModel?.(selected) ?? (myProvider as any).chatModel?.(selected);
  ```

---

## High-Level Steps

1. Add Convex schema + functions for orchestration telemetry.
2. Add **orchestrator** layer (router → planner → specialists).
3. Replace API route’s direct `streamText` with the orchestrator bridge.
4. Add **Purchase Advice** specialist (full implementation).
5. Add basic tools (webSearch with safe fallback; price/spec lookups with stubs you can later wire to real sources).
6. Add minimal planning UI scaffolds (components only; safe placeholders).
7. Ship a PR with a clear description & checklist.

---

## 0) Assumptions to align

* We already have `@/lib/ai/providers` with a function you can call to obtain a model. **If the name differs**, add a small shim:

```ts
// /frontend/lib/ai/model.ts
import { myProvider } from "@/lib/ai/providers"; // adapt import if needed
export const getModel = (selected?: string) =>
  myProvider.languageModel?.(selected) ?? myProvider.chatModel?.(selected);
```

Use `getModel(ctx.selectedChatModel)` in all `streamText()` calls.

---

## 1) Convex — Schema Additions

**Create/extend** `/convex/schema.ts` with these tables (names can stay lowercase). Use your repo’s `v` import.

```ts
// /convex/schema.ts (additions)
import { defineSchema, defineTable, v } from "convex/server";

export default defineSchema({
  // …existing tables

  runs: defineTable({
    chat_id: v.string(),
    user_id: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("error"),
      v.literal("cancelled")
    ),
    step_count: v.number(),
    token_in: v.number(),
    token_out: v.number(),
    started_at: v.number(),
    ended_at: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_chat", ["chat_id"])
    .index("by_user", ["user_id"]),

  steps: defineTable({
    run_id: v.id("runs"),
    role: v.string(), // "router" | "planner" | "specialist" | "tool" | "synthesis"
    name: v.string(),
    started_at: v.number(),
    ended_at: v.optional(v.number()),
    token_in: v.number(),
    token_out: v.number(),
    error: v.optional(v.string()),
  }).index("by_run", ["run_id"]),

  tool_calls: defineTable({
    step_id: v.id("steps"),
    name: v.string(),
    input: v.any(),
    output: v.any(),
    started_at: v.number(),
    ended_at: v.optional(v.number()),
  }).index("by_step", ["step_id"]),

  sources: defineTable({
    run_id: v.id("runs"),
    url: v.string(),
    title: v.optional(v.string()),
    snippet: v.optional(v.string()),
    meta: v.optional(v.any()),
    order: v.number(),
  }).index("by_run", ["run_id"]),
});
```

> Add token usage after each step using AI SDK `usage` metadata; patch the current `steps` row and increment `runs` totals.

### Convex functions for telemetry

Create these files with minimal mutations:

```ts
// /convex/runs.ts
import { mutation } from "./_generated/server";

export const startRun = mutation({
  args: { chat_id: "string", user_id: "string" },
  handler: async (ctx, { chat_id, user_id }) => {
    return await ctx.db.insert("runs", {
      chat_id,
      user_id,
      status: "running",
      step_count: 0,
      token_in: 0,
      token_out: 0,
      started_at: Date.now(),
    });
  },
});

export const endRun = mutation({
  args: { run_id: "id", error: "string?" },
  handler: async (ctx, { run_id, error }) => {
    await ctx.db.patch(run_id, {
      status: error ? "error" : "done",
      error: error ?? undefined,
      ended_at: Date.now(),
    });
  },
});

// Optional helpers (increment usage, cancel run, etc.) can be added later.
```

```ts
// /convex/steps.ts
import { mutation } from "./_generated/server";

export const startStep = mutation({
  args: { run_id: "id", role: "string", name: "string" },
  handler: async (ctx, { run_id, role, name }) => {
    return await ctx.db.insert("steps", {
      run_id, role, name,
      started_at: Date.now(),
      token_in: 0, token_out: 0,
    });
  },
});

export const endStep = mutation({
  args: { step_id: "id", error: "string?" },
  handler: async (ctx, { step_id, error }) => {
    await ctx.db.patch(step_id, {
      ended_at: Date.now(),
      error: error ?? undefined,
    });
  },
});
```

```ts
// /convex/tool_calls.ts
import { mutation } from "./_generated/server";

export const start = mutation({
  args: { step_id: "id", name: "string", input: "any" },
  handler: async (ctx, { step_id, name, input }) => {
    return await ctx.db.insert("tool_calls", {
      step_id, name, input, started_at: Date.now(),
    });
  },
});

export const end = mutation({
  args: { tool_call_id: "id", output: "any" },
  handler: async (ctx, { tool_call_id, output }) => {
    await ctx.db.patch(tool_call_id, { output, ended_at: Date.now() });
  },
});
```

```ts
// /convex/sources.ts
import { mutation } from "./_generated/server";

export const addMany = mutation({
  args: { run_id: "id", items: "any" },
  handler: async (ctx, { run_id, items }) => {
    let order = 1;
    for (const s of items as any[]) {
      await ctx.db.insert("sources", {
        run_id,
        url: s.url,
        title: s.title,
        snippet: s.snippet,
        meta: s.meta,
        order: order++,
      });
    }
  },
});
```

> **Note:** Use your generated `api` typing imports (`import { api } from "@/convex/_generated/api";`) in the Next.js app.

---

## 2) New Orchestrator Layer

Create these files under `/frontend/lib/ai`.

### 2.1 Types

```ts
// /frontend/lib/ai/orchestrator/types.ts
export type ToolEvent =
  | { type: "start"; name: string; input: unknown }
  | { type: "result"; name: string; output: unknown };

export type Source = { url: string; title?: string; snippet?: string; meta?: any };

export interface SpecialistResult {
  textStream: AsyncIterable<string>;
  toolEvents: AsyncIterable<ToolEvent>;
  sources?: Source[];
}

export type NextStep =
  | "plan"
  | "purchase_advice"
  | "running_cost"
  | "reliability"
  | "synthesis"
  | "finalize";

export interface RunContext {
  ui: any;                 // UIMessageStreamWriter from 'ai'
  messages: any[];         // AI SDK message format
  chatId: string;
  runId: string;
  userId: string;
  signal: AbortSignal;
  convex: any;
  selectedChatModel?: string;
  intent?: "plan" | "analyze";
}
```

### 2.2 Emit helpers (UI stream)

```ts
// /frontend/lib/ai/orchestrator/emit.ts
export const emit = (ui: any) => ({
  textDelta: (text: string) => ui.writeData({ type: "text-delta", textDelta: text }),
  toolStart: (name: string, input: unknown) =>
    ui.writeData({ type: "tool-input-available", toolName: name, toolInput: input }),
  toolResult: (name: string, output: unknown) =>
    ui.writeData({ type: "tool-output-available", toolName: name, toolResult: output }),
  sourceUrl: (url: string, title?: string) =>
    ui.writeData({ type: "source-url", url, title }),
  finishStep: () => ui.writeData({ type: "finish-step" }),
});
```

### 2.3 State wrappers (Convex)

```ts
// /frontend/lib/ai/orchestrator/state.ts
import { api } from "@/convex/_generated/api";

export async function startStep(convex: any, { runId, role, name }: any) {
  return convex.mutation(api.steps.startStep, { run_id: runId, role, name });
}
export async function endStep(convex: any, { stepId, error }: any) {
  return convex.mutation(api.steps.endStep, { step_id: stepId, error });
}
export async function addSources(convex: any, { runId, items }: any) {
  return convex.mutation(api.sources.addMany, { run_id: runId, items });
}
export async function toolStart(convex: any, { stepId, name, input }: any) {
  return convex.mutation(api.tool_calls.start, { step_id: stepId, name, input });
}
export async function toolEnd(convex: any, { tool_call_id, output }: any) {
  return convex.mutation(api.tool_calls.end, { tool_call_id, output });
}
```

### 2.4 Budget helpers

```ts
// /frontend/lib/ai/orchestrator/budget.ts
export const MAX_STEPS = 8;
export const TOOL_TIMEOUT_MS = 12000;

export async function withTimeout<T>(p: Promise<T>, ms = TOOL_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tool-timeout")), ms)),
  ]);
}

export async function withRetries<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (attempt++ >= retries) throw e;
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }
}
```

### 2.5 Router

```ts
// /frontend/lib/ai/orchestrator/router.ts
import { z } from "zod";
import { streamText } from "ai";
import { getModel } from "../model"; // the shim created above
import { ROUTER_SYSTEM } from "../prompts/router";

const NextSchema = z.object({
  next: z.enum(["plan", "purchase_advice", "running_cost", "reliability", "synthesis", "finalize"]),
  reason: z.string().optional(),
});

export async function routerAgent(ctx: any) {
  const res = await streamText({
    model: getModel(ctx.selectedChatModel),
    signal: ctx.signal,
    system: ROUTER_SYSTEM,
    messages: ctx.messages,
    tools: {
      choose: {
        description: "Select next orchestrator step",
        parameters: NextSchema,
        execute: async (args: any) => args,
      },
    },
    toolChoice: "required",
  });

  const pick = await res.toolCalls().then((c: any[]) => c.find(x => x.toolName === "choose")?.args);
  return NextSchema.parse(pick ?? { next: "finalize" });
}
```

### 2.6 Planner

```ts
// /frontend/lib/ai/orchestrator/planner.ts
import { streamText } from "ai";
import { getModel } from "../model";
import { PLANNER_SYSTEM } from "../prompts/planner";
import { webSearch } from "../tools/webSearch";
import { specLookup } from "../tools/specLookup";
import { priceLookup } from "../tools/priceLookup";

export async function plannerAgent(ctx: any) {
  const result: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    signal: ctx.signal,
    system: PLANNER_SYSTEM,
    messages: ctx.messages,
    tools: { webSearch, specLookup, priceLookup },
  });

  return {
    textStream: result.textStream,
    toolEvents: result.toolCallStream,
    sources: [],
  };
}
```

### 2.7 Orchestrator main loop

```ts
// /frontend/lib/ai/orchestrator/index.ts
import { emit } from "./emit";
import { startStep, endStep, addSources } from "./state";
import { routerAgent } from "./router";
import { plannerAgent } from "./planner";
import { purchaseAdvice } from "../agents/purchase";
import { MAX_STEPS } from "./budget";

const specialists: Record<string, any> = {
  plan: plannerAgent,
  purchase_advice: purchaseAdvice,
  running_cost: async (ctx: any) => ({
    // TODO: implement specialist
    textStream: (async function*(){ yield "Running cost specialist is not yet implemented.\n"; })(),
    toolEvents: (async function*(){})(),
  }),
  reliability: async (ctx: any) => ({
    // TODO: implement specialist
    textStream: (async function*(){ yield "Reliability specialist is not yet implemented.\n"; })(),
    toolEvents: (async function*(){})(),
  }),
  synthesis: async (ctx: any) => ({
    textStream: (async function*(){ yield "Synthesis step (optional).\n"; })(),
    toolEvents: (async function*(){})(),
  }),
};

export async function runOrchestrator(ctx: any) {
  const { ui, convex, runId, signal } = ctx;
  const out = emit(ui);

  let step = 0;
  while (step++ < MAX_STEPS && !signal.aborted) {
    const route = await routerAgent(ctx);
    if (route.next === "finalize") break;

    const role = route.next === "plan" ? "planner" : "specialist";
    const name = route.next;
    const stepId = await startStep(convex, { runId, role, name });

    try {
      const impl = specialists[route.next];
      const result = await impl(ctx);

      for await (const d of result.textStream) out.textDelta(d);
      for await (const e of result.toolEvents) {
        if (e.type === "start") out.toolStart(e.name, e.input);
        if (e.type === "result") out.toolResult(e.name, e.output);
      }
      if (result.sources?.length) {
        await addSources(convex, { runId, items: result.sources });
        for (const s of result.sources) out.sourceUrl(s.url, s.title);
      }
      out.finishStep();
      await endStep(convex, { stepId });
    } catch (e: any) {
      await endStep(convex, { stepId, error: String(e?.message || e) });
      throw e;
    }
  }
}
```

---

## 2.8 API glue (repo‑aware)

- File: `/frontend/app/(chat)/api/chat/route.ts`
- Under `featureFlags.agentsOrchestrator`, replace the direct `streamText` block with a call to `runOrchestrator` inside `createUIMessageStream`.
- Keep existing Clerk auth, chat creation/saving, and error handling unchanged.
- Optional follow‑up: add `resumable-stream` like the deep‑research example for reload‑resilience.

---

## 3) Prompts

```ts
// /frontend/lib/ai/prompts/router.ts
export const ROUTER_SYSTEM = `
You are the ROUTER for a car analysis assistant.
Return JSON via the 'choose' tool:

{
  "next": "plan" | "purchase_advice" | "running_cost" | "reliability" | "synthesis" | "finalize",
  "reason": string
}

Rules:
- If car details are not normalized/confirmed, choose "plan".
- After planning is complete, choose exactly ONE specialist.
- Choose "synthesis" if enough evidence exists to summarize.
- Choose "finalize" when the user indicates they are done.
`;
```

```ts
// /frontend/lib/ai/prompts/planner.ts
export const PLANNER_SYSTEM = `
You are the PLANNER. Tasks:
1) Interpret the user's input (text/listing/image meta).
2) Normalize it into { make, model, year, body?, trim?, engine? } for Ireland.
3) If ambiguous, ask up to 2 targeted clarifying questions.
4) Propose 2–4 candidate matches with short spec/price notes using tools.
5) Wait for user confirmation before heavy analysis.

Markdown:
## Understanding
## Candidate Matches
## What I still need (only if ambiguous)
## Next
Use inline citations like [1], [2] after claims from sources.
`;
```

```ts
// /frontend/lib/ai/prompts/purchase.ts
export const PURCHASE_SYSTEM = `
You are the PURCHASE ADVICE specialist for Ireland.
- Compare trims/engines, safety/tech, resale, and common issues.
- Use tools (specLookup, priceLookup, webSearch) before concluding.
- Include inline citations [1], [2] after factual claims.
- Be concise and actionable.

Markdown:
## Snapshot
## Strengths & Trade-offs
## Trim & Engine Advice
## Price & Value (new/used bands)
## Alternatives worth a look
## Bottom line
`;
```

---

## 4) Tools (with safe fallbacks)

### 4.1 webSearch (Tavily if available, else safe stub)

```ts
// /frontend/lib/ai/tools/webSearch.ts
import { z } from "zod";

type WebResult = { title: string; url: string; snippet?: string };
const TAVILY = process.env.TAVILY_API_KEY;

export const webSearch = {
  description: "Search the web for up-to-date info.",
  parameters: z.object({
    q: z.string(),
    k: z.number().min(1).max(5).default(3),
  }),
  execute: async ({ q, k }: { q: string; k: number }) => {
    if (TAVILY) {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY}` },
        body: JSON.stringify({ query: q, max_results: k }),
      });
      const data = await resp.json().catch(() => ({}));
      const results: WebResult[] =
        data?.results?.slice(0, k).map((r: any) => ({ title: r.title, url: r.url, snippet: r.content })) ?? [];
      return { results };
    }
    // Fallback: return empty or minimal examples
    return { results: [] };
  },
};
```

### 4.2 priceLookup (stub with obvious structure)

```ts
// /frontend/lib/ai/tools/priceLookup.ts
import { z } from "zod";

export const priceLookup = {
  description: "Estimate price bands for a given car in Ireland.",
  parameters: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().int().optional(),
  }),
  execute: async ({ make, model, year }: any) => {
    // TODO: integrate real data sources; for now return sane placeholder bands.
    const base = 15000;
    const variance = year ? Math.max(0, 2025 - year) * 500 : 2000;
    return {
      currency: "EUR",
      used_low: base - variance,
      used_high: base + variance,
      new_msrp_est: base + 8000,
      sources: [],
    };
  },
};
```

### 4.3 specLookup (stub)

```ts
// /frontend/lib/ai/tools/specLookup.ts
import { z } from "zod";

export const specLookup = {
  description: "Return high-level spec info for a car (engine/fuel/body).",
  parameters: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().int().optional(),
  }),
  execute: async ({ make, model, year }: any) => {
    // TODO: wire proper provider. For now, return indicative fields.
    return {
      body: "Hatchback",
      fuel: "Petrol",
      transmission: "Automatic",
      power_kw: 90,
      sources: [],
    };
  },
};
```

---

## 5) Specialists

### 5.1 Purchase Advice — **full specialist**

```ts
// /frontend/lib/ai/agents/purchase.ts
import { streamText } from "ai";
import { PURCHASE_SYSTEM } from "../prompts/purchase";
import { getModel } from "../model";
import { webSearch } from "../tools/webSearch";
import { priceLookup } from "../tools/priceLookup";
import { specLookup } from "../tools/specLookup";

export async function purchaseAdvice(ctx: any) {
  const result: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    signal: ctx.signal,
    system: PURCHASE_SYSTEM,
    messages: ctx.messages,
    tools: { webSearch, priceLookup, specLookup },
  });

  return {
    textStream: result.textStream,
    toolEvents: result.toolCallStream,
    sources: [], // Build from tool outputs later if needed
  };
}
```

> **Running Cost** and **Reliability** specialists are left as TODO in `orchestrator/index.ts`. You will add them later following this pattern.

---

## 6) API route glue

**Edit only this file’s internals** (keep Clerk, Convex, and message saving as-is).

```ts
// /frontend/app/(chat)/api/chat/route.ts
import { NextRequest } from "next/server";
import { createDataStreamResponse, createUIMessageStream } from "ai";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import { currentUser } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { convexClient } from "@/lib/convex/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { messages, conversationId, intent, selectedChatModel } = await req.json();
  const convex = convexClient();

  return createDataStreamResponse(async (stream) => {
    const ui = createUIMessageStream(stream);
    const ac = new AbortController();
    req.signal.addEventListener("abort", () => ac.abort());

    const runId = await convex.mutation(api.runs.startRun, {
      chat_id: conversationId,
      user_id: user.id,
    });

    try {
      await runOrchestrator({
        ui,
        messages,
        chatId: conversationId,
        runId,
        userId: user.id,
        signal: ac.signal,
        convex,
        selectedChatModel,
        intent, // "plan" | "analyze" | undefined
      });
      await convex.mutation(api.runs.endRun, { run_id: runId });
    } catch (e: any) {
      await convex.mutation(api.runs.endRun, { run_id: runId, error: String(e?.message || e) });
      throw e;
    } finally {
      ui.done();
    }
  });
}
```

---

## 7) Minimal Planning UI scaffolds (optional in this PR)

Create simple placeholders (Tailwind ok). Don’t change routing; components will be mounted on the landing page later.

```tsx
// /frontend/components/CarFinder/CarSearchBox.tsx
"use client";
import { useState } from "react";

export default function CarSearchBox({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <div className="w-full max-w-2xl">
      <input
        className="w-full rounded-xl border p-3"
        placeholder="e.g., 2020 Toyota Corolla Hybrid"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button className="mt-2 rounded-lg border px-4 py-2" onClick={() => onSubmit(q)}>
        Plan analysis
      </button>
    </div>
  );
}
```

```tsx
// /frontend/components/CarFinder/SuggestedMatches.tsx
export default function SuggestedMatches({ items = [] as any[], onPick = (i: any) => {} }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it, idx) => (
        <button key={idx} className="rounded-xl border p-3 text-left hover:bg-gray-50"
          onClick={() => onPick(it)}>
          <div className="font-medium">{it.title}</div>
          <div className="text-sm text-gray-600">{it.subtitle}</div>
        </button>
      ))}
    </div>
  );
}
```

```tsx
// /frontend/components/CarFinder/AnalysisPicker.tsx
export default function AnalysisPicker({ onPick }: { onPick: (kind: "purchase"|"running"|"reliability") => void }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <button className="rounded-xl border p-4 hover:bg-gray-50" onClick={() => onPick("purchase")}>
        Purchase Advice
      </button>
      <button className="rounded-xl border p-4 hover:bg-gray-50" onClick={() => onPick("running")}>
        Running Cost
      </button>
      <button className="rounded-xl border p-4 hover:bg-gray-50" onClick={() => onPick("reliability")}>
        Reliability
      </button>
    </div>
  );
}
```

---

## 8) Testing & Acceptance

* Start app, create a new conversation, send “2019 Corolla Hybrid”.

  * Router should choose **plan** → Planner streams markdown.
* Send “Analyze purchase value.”

  * Router should choose **purchase\_advice** → Purchase Advice specialist streams sections.
* Confirm the stream contains `text-delta`, and you see `finish-step` events in the network stream.
* Convex should have a `runs` row + `steps` rows for planner and specialist.

---

## 9) PR Title & Description

**Title:** add orchestrator (router → planner → purchase specialist) + telemetry + tools

**Description (checklist):**

* [x] Convex schema: `runs`, `steps`, `tool_calls`, `sources`
* [x] Convex mutations for runs/steps/tools/sources
* [x] Orchestrator layer with router & planner
* [x] Purchase Advice specialist (full)
* [x] Tools: `webSearch` (Tavily or stub), `specLookup` (stub), `priceLookup` (stub)
* [x] API route now calls `runOrchestrator` and streams UI parts
* [x] Minimal planning UI scaffolds (not wired yet)
* [x] Abort-safe and no breaking changes to existing chat save logic

---

## 10) Follow-ups (post-merge)

* Implement **Running Cost** and **Reliability** specialists.
* Wire **sources** from tool outputs → stream `source-url` parts (and link `[1]`, `[2]` inline tags).
* Add **resumable stream** like the deep-research repo (optional).
* Replace stubs in `priceLookup`/`specLookup` with real providers.
* Add Playwright tests to assert stream event order and router choices.

---

## 11) UI Integration Plan (repo‑aware)

We keep the current chat UI (greeting, suggestions grid, composer, history sidebar, artifact overlay). New panels mount conditionally without routing changes.

### Components (new)

```
/frontend/components/Orchestrator/
  HeroQuickActions.tsx   # badge + Start Planning / Try Purchase Advice
  PlannerPanel.tsx       # search input + image drop + progress + tips + suggested matches
  ConfirmPanel.tsx       # selected car summary + quick edits + CTAs
  AnalysisPanel.tsx      # left: streaming markdown; right: sources + next actions
```

### Mount points

- `components/messages.tsx`
  - On empty chat (no messages) + orchestrator flag ON → render `HeroQuickActions` above the suggestions grid.
  - When mode = `planning` → render `PlannerPanel` in the main content area (keeps composer and suggestions intact).
  - When mode = `confirm` → render `ConfirmPanel`.
  - When mode = `analysis:*` → render `AnalysisPanel`.

- No changes to composer (`MultimodalInput`), suggestions (`SuggestedActions`), history sidebar, or artifact overlay behavior.

### State

- `lib/stores/orchestrator-store.ts` (Zustand)
  - `mode: 'idle' | 'planning' | 'confirm' | 'analysis:purchase' | 'analysis:running' | 'analysis:reliability'`
  - `selectedCar`, `sources`, `progress`

### SSE wiring

- Extend the existing data stream handler to route:
  - `planner-state` → set `selectedCar` and switch to `confirm`
  - `source-url` → append to sources
  - `finish-step` → mark step complete

---

## Done

Create the files exactly as shown, keep imports consistent, and make the single route change. Don’t touch unrelated code. If a model/provider name differs, use the `/lib/ai/model.ts` shim to adapt.

Ping me in the PR with:

* A short demo video (screen capture) showing plan → purchase advice streaming
* A screenshot of Convex rows for `runs`/`steps` for that demo

Thanks!
