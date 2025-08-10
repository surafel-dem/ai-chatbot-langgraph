import { streamText, smoothStream } from 'ai';
import { getModel } from '../model';
import { RUNNING_SYSTEM } from '../prompts/running';
import { emit } from '../orchestrator/emit';
import type { RunContext } from '../orchestrator/types';
import { webSearch } from '../tools/webSearch';
import { priceLookup } from '../tools/priceLookup';
import { specLookup } from '../tools/specLookup';

export async function runningCostAgent(ctx: RunContext) {
  const ui = emit(ctx.ui);

  // Run tools lightly up-front for grounding
  ui.toolStart('specLookup', { context: 'running_cost' });
  const spec = await specLookup.execute({ make: '', model: '', year: undefined }).catch(() => ({}));
  ui.toolResult('specLookup', spec);

  ui.toolStart('priceLookup', { context: 'running_cost' });
  const prices = await priceLookup.execute({ make: '', model: '', year: undefined }).catch(() => ({}));
  ui.toolResult('priceLookup', prices);

  ui.toolStart('webSearch', { q: 'running cost ownership fuel tax insurance Ireland', k: 2 });
  const search = await webSearch.execute({ q: 'running cost ownership fuel tax insurance Ireland', k: 2 }).catch(() => ({ results: [] }));
  ui.toolResult('webSearch', search);

  const sources = (search.results ?? []).map((r: any) => ({ url: r.url, title: r.title, snippet: r.snippet }));
  for (const s of sources) ui.sourceUrl(s.url, s.title);

  const result: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    messages: [
      ...ctx.messages,
      { role: 'system', content: RUNNING_SYSTEM },
    ],
    abortSignal: ctx.signal,
    experimental_transform: smoothStream({ chunking: 'word' }),
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

  async function* toolEvents() { return; }

  return { textStream: textStream(), toolEvents: toolEvents(), sources } as const;
}


