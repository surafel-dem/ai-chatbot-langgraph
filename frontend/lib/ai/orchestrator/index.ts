import { emit } from './emit';
import { startStep, endStep, addSources } from './state';
import { routerAgent } from './router';
import { plannerAgent } from './planner';
import { MAX_STEPS } from './budget';
import { purchaseAdviceAgent } from '../agents/purchase';
import { runningCostAgent } from '../agents/running';
import { reliabilityAgent } from '../agents/reliability';

const specialists: Record<string, any> = {
  plan: plannerAgent,
  purchase_advice: purchaseAdviceAgent,
  running_cost: runningCostAgent,
  reliability: reliabilityAgent,
  synthesis: async () => ({
    textStream: (async function* () {
      yield 'Synthesis step (optional).\n';
    })(),
    toolEvents: (async function* () {})(),
  }),
};

export async function runOrchestrator(ctx: any) {
  const out = emit(ctx.ui);

  out.status('Starting orchestrator...');

  // Execute exactly one step per request to avoid loops and long busy states
  // If an explicit intent is provided (from quick link), honor it
  const route = ctx.intent
    ? { next: ctx.intent === 'plan' ? 'plan' : ctx.intent }
    : await routerAgent(ctx);
  out.status(`Router selected: ${route.next}`);
  if (route.next === 'finalize') return;

  const role = route.next === 'plan' ? 'planner' : 'specialist';
  const name = route.next;
  const stepId = await startStep(ctx.convex, { runId: ctx.runId, role, name });

  try {
    // Pass planner-state through ctx.selectedCar when available
    const impl = specialists[route.next];
    const result = await impl(ctx);

    for await (const _d of result.textStream) {
      // already emitted
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
    out.textDelta(`Error in step ${name}: ${String(e?.message || e)}\n`);
    await endStep(ctx.convex, { stepId, error: String(e?.message || e) });
    throw e;
  }
}


