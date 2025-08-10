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

  // Ask for details if missing
  const lastUser = [...(ctx.messages as any[])].reverse().find((m: any) => m.role === 'user');
  const text = typeof lastUser?.content === 'string'
    ? (lastUser?.content as string)
    : Array.isArray((lastUser as any)?.parts)
      ? (lastUser as any).parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join(' ')
      : '';
  if (!/\b[a-z]{2,}\b/i.test(text)) {
    async function* ask() {
      const msg = 'Which car should I check reliability for? Please include make, model, and year.';
      ui.textDelta(msg);
      return;
    }
    async function* empty() { return; }
    return { textStream: ask(), toolEvents: empty(), sources } as const;
  }

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


