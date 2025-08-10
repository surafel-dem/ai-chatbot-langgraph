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

  // Debug visibility: prove orchestrator path is running
  out.status('Starting orchestrator...');

  let stepNum = 0;
  let plannedOnce = false;
  let executedSpecialist = false;
  while (stepNum++ < MAX_STEPS && !ctx.signal.aborted) {
    let route = await routerAgent(ctx);

    // Do not force a particular specialist; trust the router after planning.

    out.status(`Router selected: ${route.next}`);
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

      if (name === 'plan') plannedOnce = true;
      if (name !== 'plan') executedSpecialist = true;
      if (executedSpecialist) break; // end after first specialist for now
    } catch (e: any) {
      out.textDelta(`Error in step ${name}: ${String(e?.message || e)}\n`);
      await endStep(ctx.convex, { stepId, error: String(e?.message || e) });
      throw e;
    }
  }
}


