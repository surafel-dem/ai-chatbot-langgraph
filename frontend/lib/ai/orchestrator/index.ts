import { emit } from './emit';
import { startStep, endStep, addSources } from './state';
import { routerAgent } from './router';
import { plannerAgent } from './planner';
import { MAX_STEPS } from './budget';

const specialists: Record<string, any> = {
  plan: plannerAgent,
  purchase_advice: async () => ({
    textStream: (async function* () {
      yield 'Purchase specialist not implemented in this phase.\n';
    })(),
    toolEvents: (async function* () {})(),
  }),
  running_cost: async () => ({
    textStream: (async function* () {
      yield 'Running cost specialist not implemented.\n';
    })(),
    toolEvents: (async function* () {})(),
  }),
  reliability: async () => ({
    textStream: (async function* () {
      yield 'Reliability specialist stub.\n';
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
  const { ui, convex, runId, signal } = ctx;
  const out = emit(ui);

  let step = 0;
  while (step++ < MAX_STEPS && !signal.aborted) {
    const route = await routerAgent(ctx);
    if (route.next === 'finalize') break;

    const role = route.next === 'plan' ? 'planner' : 'specialist';
    const name = route.next;
    const stepId = await startStep(convex, { runId, role, name });

    try {
      const impl = specialists[route.next];
      const result = await impl(ctx);

      for await (const d of result.textStream) out.textDelta(d);
      for await (const e of result.toolEvents) {
        if (e.type === 'start') out.toolStart(e.name, e.input);
        if (e.type === 'result') out.toolResult(e.name, e.output);
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

 