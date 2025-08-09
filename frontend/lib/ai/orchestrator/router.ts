import { z } from 'zod';
import { streamText } from 'ai';
import { getModel } from '../model';

const NextSchema = z.object({
  next: z.enum(['plan', 'purchase_advice', 'running_cost', 'reliability', 'synthesis', 'finalize']),
  reason: z.string().optional(),
});

export async function routerAgent(ctx: any) {
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
  return NextSchema.parse(pick ?? { next: 'finalize' });
}


