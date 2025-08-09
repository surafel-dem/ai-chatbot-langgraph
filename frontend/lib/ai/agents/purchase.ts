import { z } from 'zod';
import { streamText, smoothStream, generateObject } from 'ai';
import { getModel } from '../model';
import { emit } from '../orchestrator/emit';
import type { RunContext } from '../orchestrator/types';
import { webSearch } from '../tools/webSearch';
import { priceLookup } from '../tools/priceLookup';
import { specLookup } from '../tools/specLookup';

const PlanSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  questions: z.array(z.string()).max(3).optional(),
  focus: z.array(z.enum(['value', 'performance', 'efficiency', 'comfort', 'tech'])).optional(),
});

export async function purchaseAdviceAgent(ctx: RunContext) {
  const ui = emit(ctx.ui);

  // 1) Derive a short plan (structured) from the dialog
  const { object: plan } = await generateObject({
    model: getModel(ctx.selectedChatModel),
    schema: PlanSchema,
    messages: ctx.messages,
    abortSignal: ctx.signal,
    system: 'Extract target car (make/model/year) and user focus to guide purchase advice.',
  });

  // 2) Run tools (spec + price + web) sequentially now; can parallelize later
  ui.toolStart('specLookup', plan);
  const spec = await specLookup.execute({ make: plan.make ?? '', model: plan.model ?? '', year: plan.year });
  ui.toolResult('specLookup', spec);

  ui.toolStart('priceLookup', plan);
  const prices = await priceLookup.execute({ make: plan.make ?? '', model: plan.model ?? '', year: plan.year });
  ui.toolResult('priceLookup', prices);

  ui.toolStart('webSearch', { q: `${plan.make ?? ''} ${plan.model ?? ''} ${plan.year ?? ''} review Ireland`, k: 3 });
  const search = await webSearch.execute({ q: `${plan.make ?? ''} ${plan.model ?? ''} ${plan.year ?? ''} review Ireland`, k: 3 });
  ui.toolResult('webSearch', search);

  // Emit sources from web results
  const sources = (search.results ?? []).map((r: any) => ({ url: r.url, title: r.title, snippet: r.snippet }));
  for (const s of sources) ui.sourceUrl(s.url, s.title);

  // 3) Stream a concise synthesis
  const result: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    messages: [
      ...ctx.messages,
      {
        role: 'system',
        content:
          'You are the PURCHASE ADVICE specialist. Combine specs, price bands, and web reviews for Ireland. Provide trims to consider, pros/cons, and value judgement. Output must be concise, non-repetitive, and in plain paragraphs with short headings. Avoid repeating phrases or list numbers. Do not echo the user input.',
      },
    ],
    experimental_transform: smoothStream({ chunking: 'word' }),
    abortSignal: ctx.signal,
  });

  async function* textStream() {
    for await (const delta of result.fullStream) {
      if ((delta as any).type === 'text' || (delta as any).type === 'text-delta') {
        const text = (delta as any).text;
        if (text) ui.textDelta(text);
        yield text as string;
      }
    }
  }

  async function* toolEvents() {
    // Tools already emitted via ui; no separate event channel needed for now
    return;
  }

  return { textStream: textStream(), toolEvents: toolEvents(), sources } as const;
}


