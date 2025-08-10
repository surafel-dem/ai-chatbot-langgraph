import { z } from 'zod';
import { streamText } from 'ai';
import { getModel } from '../model';
import { ROUTER_SYSTEM } from '../prompts/router';

const NextSchema = z.object({
  next: z.enum(['plan', 'purchase_advice', 'running_cost', 'reliability', 'synthesis', 'finalize']),
  reason: z.string().optional(),
});

export async function routerAgent(ctx: any) {
  const res: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    signal: ctx.signal,
    system: ROUTER_SYSTEM,
    messages: ctx.messages,
    tools: {
      choose: {
        description: 'Select next orchestrator step',
        parameters: NextSchema,
        execute: async (args: any) => args,
      },
    },
    toolChoice: 'required',
  });

  const pick = await res.toolCalls().then((c: any[]) => c.find((x) => x.toolName === 'choose')?.args);
  return NextSchema.parse(pick ?? { next: 'finalize' });
}

 