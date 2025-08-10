import { streamText, smoothStream } from 'ai';
import { getModel } from '../model';
import { RELIABILITY_SYSTEM } from '../prompts/reliability';
import { emit } from '../orchestrator/emit';
import type { RunContext } from '../orchestrator/types';
import { webSearch } from '../tools/webSearch';
import { specLookup } from '../tools/specLookup';

export async function reliabilityAgent(ctx: RunContext) {
  const ui = emit(ctx.ui);

  ui.toolStart('webSearch', { q: 'car common issues recalls reliability Ireland', k: 3 });
  const search = await webSearch.execute({ q: 'car common issues recalls reliability Ireland', k: 3 }).catch(() => ({ results: [] }));
  ui.toolResult('webSearch', search);

  ui.toolStart('specLookup', { context: 'reliability' });
  const spec = await specLookup.execute({ make: '', model: '', year: undefined }).catch(() => ({}));
  ui.toolResult('specLookup', spec);

  const sources = (search.results ?? []).map((r: any) => ({ url: r.url, title: r.title, snippet: r.snippet }));
  for (const s of sources) ui.sourceUrl(s.url, s.title);

  const result: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    messages: [
      ...ctx.messages,
      { role: 'system', content: RELIABILITY_SYSTEM },
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


