import { streamText, smoothStream } from 'ai';
import { getModel } from '../model';
import { emit } from './emit';

export async function plannerAgent(ctx: any) {
  const ui = emit(ctx.ui);

  const result: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    system:
      'You are the PLANNER. Normalize user input into {make, model, year, body?, trim?, engine?}. Ask up to 2 clarifying questions if needed. Markdown headings allowed.',
    messages: ctx.messages,
    experimental_transform: smoothStream({ chunking: 'word' }),
    abortSignal: ctx.signal,
  });

  // Mirror AI SDK text stream to UI writer
  async function* textStream() {
    for await (const delta of result.fullStream) {
      if ((delta as any).type === 'text' || (delta as any).type === 'text-delta') {
        const text = (delta as any).text;
        if (text) ui.textDelta(text);
        yield text as string;
      }
    }
    // At the end, emit a lightweight planner-state placeholder for now
    ui.plannerState({ make: 'TBD', model: 'TBD', year: undefined });
  }

  async function* toolEvents() {
    // Planner currently uses no structured tools; reserved for future
    return;
  }

  return {
    textStream: textStream(),
    toolEvents: toolEvents(),
    sources: [],
  } as const;
}


