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

  const decide = async () => {
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

    const pick = await res
      .toolCalls()
      .then((calls: any[]) => calls.find((c) => c.toolName === 'choose')?.args);
    return NextSchema.parse(pick ?? { next: 'plan' });
  };

  // Fallback to plan after 2 seconds if the model is unavailable
  try {
    return await Promise.race([
      decide(),
      new Promise<any>((resolve) => setTimeout(() => resolve({ next: 'plan' as const, reason: 'timeout' }), 2000)),
    ]);
  } catch {
    return { next: 'plan' as const, reason: 'error' };
  }
}


