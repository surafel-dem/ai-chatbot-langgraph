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
    const users = (ctx.messages ?? []).filter((m: any) => m.role === 'user');
    const extract = (m: any) =>
      typeof m?.content === 'string'
        ? (m.content as string)
        : Array.isArray(m?.parts)
          ? m.parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join(' ')
          : '';
    const last = users.at(-1);
    const first = users.at(0);
    const lastText = extract(last);
    const firstText = extract(first);
    const userCount = users.length;

    // First send with [orchestrator]: if it clearly names an intent, go straight to that specialist; else plan
    if (lastText.includes('[orchestrator]') && userCount === 1) {
      const detectedInit = ((): any => {
        const t = lastText.toLowerCase();
        if (/running cost|running costs|cost analysis|mpg|insurance|tax/.test(t)) return 'running_cost' as const;
        if (/reliability|common issues|recalls?/.test(t)) return 'reliability' as const;
        if (/purchase advice|buy|compare|vs\b/.test(t)) return 'purchase_advice' as const;
        return null;
      })();
      if (detectedInit) return { next: detectedInit, reason: 'specialist_from_first' };
      return { next: 'plan' as const, reason: 'forced_by_ui' };
    }

    const allText = (users.map(extract).join(' ') || '').toLowerCase();
    const intentFromAll = (txt: string) => {
      if (/running cost|running costs|cost analysis|mpg|insurance|tax/.test(txt)) return 'running_cost' as const;
      if (/reliability|common issues|recalls?/.test(txt)) return 'reliability' as const;
      if (/purchase advice|should i buy|compare|vs\b/.test(txt)) return 'purchase_advice' as const;
      return null;
    };

    const detectedAll = intentFromAll(allText);
    if (userCount > 1 && detectedAll) {
      return { next: detectedAll, reason: 'heuristic_from_history' };
    }
    // Short follow-ups like "sedan" after planning → pick from first user intent or default to purchase
    if (userCount > 1 && lastText.length <= 40) {
      const detectedFirst = intentFromAll((firstText || '').toLowerCase());
      return { next: detectedFirst ?? ('purchase_advice' as const), reason: 'followup_after_plan' };
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


