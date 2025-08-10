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

  // Try to extract target car from the latest messages if present
  const lastUser = [...ctx.messages].reverse().find((m: any) => m.role === 'user');
  const text = typeof lastUser?.content === 'string'
    ? (lastUser?.content as string)
    : Array.isArray((lastUser as any)?.parts)
      ? (lastUser as any).parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join(' ')
      : '';
  // Very loose regex extraction (best-effort)
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : undefined;
  // We leave make/model empty if not obvious; tools can still return structure

  // Run tools lightly up-front for grounding
  ui.toolStart('specLookup', { context: 'running_cost', text });
  const spec = await specLookup.execute({ make: '', model: '', year }).catch(() => ({}));
  ui.toolResult('specLookup', spec);

  ui.toolStart('priceLookup', { context: 'running_cost', text });
  const prices = await priceLookup.execute({ make: '', model: '', year }).catch(() => ({}));
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


