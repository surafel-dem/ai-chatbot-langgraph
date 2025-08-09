import { emit } from './emit';
import { startStep, endStep, addSources } from './state';
import { routerAgent } from './router';
import { plannerAgent } from './planner';
import { MAX_STEPS } from './budget';

const specialists: Record<string, any> = {
  plan: plannerAgent,
  purchase_advice: async (ctx: any) => ({
    // placeholder; will be replaced by full specialist
    textStream: (async function* () {
      yield 'Starting Purchase Advice...\n';
      yield 'This specialist will analyze trims, value, and alternatives.\n';
    })(),
    toolEvents: (async function* () {})(),
  }),
  running_cost: async () => ({
    textStream: (async function* () {
      yield 'Running cost specialist is not implemented yet.\n';
    })(),
    toolEvents: (async function* () {})(),
  }),
  reliability: async () => ({
    textStream: (async function* () {
      yield 'Reliability specialist is not implemented yet.\n';
    })(),
    toolEvents: (async function* () {})(),
  }),
  synthesis: async () => ({
    textStream: (async function* () {
      yield 'Synthesis step (optional).\n';
    })(),
    toolEvents: (async function* () {})(),
  }),
};

export async function runOrchestrator(ctx: any) {
  const out = emit(ctx.ui);

  let stepNum = 0;
  while (stepNum++ < MAX_STEPS && !ctx.signal.aborted) {
    const route = await routerAgent(ctx);
    if (route.next === 'finalize') break;

    const role = route.next === 'plan' ? 'planner' : 'specialist';
    const name = route.next;
    const stepId = await startStep(ctx.convex, { runId: ctx.runId, role, name });

    try {
      const impl = specialists[route.next];
      const result = await impl(ctx);

      for await (const d of result.textStream) {
        // already emitted via emit() inside agents when applicable
      }

      for await (const e of result.toolEvents) {
        if (e.type === 'start') out.toolStart(e.name, (e as any).input);
        if (e.type === 'result') out.toolResult(e.name, (e as any).output);
      }

      if (result.sources?.length) {
        await addSources(ctx.convex, { runId: ctx.runId, items: result.sources });
        for (const s of result.sources) out.sourceUrl(s.url, s.title);
      }

      out.finishStep();
      await endStep(ctx.convex, { stepId });
    } catch (e: any) {
      await endStep(ctx.convex, { stepId, error: String(e?.message || e) });
      throw e;
    }
  }
}


