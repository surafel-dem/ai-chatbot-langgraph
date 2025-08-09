import { z } from 'zod';
import { streamText } from 'ai';
import { getModel } from '../model';

const NextSchema = z.object({
  next: z.enum(['plan', 'purchase_advice', 'running_cost', 'reliability', 'synthesis', 'finalize']),
  reason: z.string().optional(),
});

export async function routerAgent(ctx: any) {
  // If the last user message contains an orchestrator tag, prefer planning
  try {
    const last = ctx.messages?.slice()?.reverse()?.find((m: any) => m.role === 'user');
    if (last && typeof last.content === 'string' && last.content.includes('[orchestrator]')) {
      return { next: 'plan' as const, reason: 'forced_by_ui' };
    }
  } catch {}

  const res: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    system:
      'You are the ROUTER for a car analysis assistant. Decide the next step. Use the choose tool to return JSON { next, reason }.',
    messages: ctx.messages,
    tools: {
      choose: {
        description: 'Select next orchestrator step',
        parameters: NextSchema,
        execute: async (args: any) => args,
      },
    },
    toolChoice: 'required',
    abortSignal: ctx.signal,
  });

  const pick = await res.toolCalls().then((calls: any[]) => calls.find((c) => c.toolName === 'choose')?.args);
  // Prefer starting with a planning pass in case of uncertainty
  return NextSchema.parse(pick ?? { next: 'plan' });
}


