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
  let plan: z.infer<typeof PlanSchema> = {};
  try {
    const { object } = await generateObject({
      model: getModel(ctx.selectedChatModel),
      schema: PlanSchema,
      messages: ctx.messages,
      abortSignal: ctx.signal,
      system: 'Extract target car (make/model/year) and user focus to guide purchase advice.',
    });
    plan = object ?? {};
  } catch {
    const lastUser = [...(ctx.messages as any[])].reverse().find((m: any) => m.role === 'user');
    const raw = typeof lastUser?.content === 'string'
      ? (lastUser?.content as string)
      : Array.isArray((lastUser as any)?.parts)
        ? (lastUser as any).parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join(' ')
        : '';
    const text = raw.replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : undefined;
    const fuelMatch = text.toLowerCase().match(/\b(petrol|diesel|hybrid|ev|electric)\b/);
    const fuel = fuelMatch ? fuelMatch[1] : undefined;
    // Heuristic parse: first word as make, words until year/fuel as model
    const tokens = text.split(' ');
    let make: string | undefined = undefined;
    let modelTokens: string[] = [];
    if (tokens.length >= 2) {
      make = tokens[0];
      for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i];
        if (/^(19|20)\d{2}$/.test(t) || /^(petrol|diesel|hybrid|ev|electric)$/i.test(t)) break;
        modelTokens.push(t);
      }
    }
    const model = modelTokens.join(' ') || undefined;
    plan = { make, model, year, focus: ['value'] } as any;
  }

  // If not enough details, ask a concise clarification and end quickly
  if (!plan.make || !plan.model) {
    async function* quickAsk() {
      const text = 'Please specify the target car (make, model, year) so I can advise on trims, pricing, and value.';
      ui.textDelta(text);
      return;
    }
    async function* empty() { return; }
    return { textStream: quickAsk(), toolEvents: empty(), sources: [] } as const;
  }

  // 2) Run tools (spec + price + web) with guards
  let spec: any = {};
  try {
    ui.toolStart('specLookup', plan);
    spec = await specLookup.execute({ make: plan.make ?? '', model: plan.model ?? '', year: plan.year });
    ui.toolResult('specLookup', spec);
  } catch (e) {
    ui.toolResult('specLookup', { error: String((e as any)?.message || e) });
  }

  let prices: any = {};
  try {
    ui.toolStart('priceLookup', plan);
    prices = await priceLookup.execute({ make: plan.make ?? '', model: plan.model ?? '', year: plan.year });
    ui.toolResult('priceLookup', prices);
  } catch (e) {
    ui.toolResult('priceLookup', { error: String((e as any)?.message || e) });
  }

  let search: any = { results: [] };
  try {
    ui.toolStart('webSearch', { q: `${plan.make ?? ''} ${plan.model ?? ''} ${plan.year ?? ''} review Ireland`, k: 3 });
    search = await webSearch.execute({ q: `${plan.make ?? ''} ${plan.model ?? ''} ${plan.year ?? ''} review Ireland`, k: 3 });
    ui.toolResult('webSearch', search);
  } catch (e) {
    ui.toolResult('webSearch', { error: String((e as any)?.message || e) });
  }

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


