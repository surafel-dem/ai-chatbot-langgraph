import { streamText, smoothStream, generateObject } from 'ai';
import { getModel } from '../model';
import { emit } from './emit';
import { z } from 'zod';

export async function plannerAgent(ctx: any) {
  const ui = emit(ctx.ui);

  // Derive a concise normalized car object first
  const CarSchema = z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().int().optional(),
    body: z.string().optional(),
    trim: z.string().optional(),
    engine: z.string().optional(),
    questions: z.array(z.string()).optional(),
  });

  const { object: plan } = await generateObject({
    model: getModel(ctx.selectedChatModel),
    schema: CarSchema,
    messages: ctx.messages,
    abortSignal: ctx.signal,
    system:
      'Extract a minimal normalized car {make, model, year, body?, trim?, engine?} and up to 2 clarifying questions if needed.',
  });

  const result: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    system:
      'You are the PLANNER. Normalize user input into {make, model, year, body?, trim?, engine?}. Ask up to 2 clarifying questions only if truly needed. Output must be concise. No duplicated words. Use plain sentences without list numbering. Do not repeat earlier text.',
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
    // Emit the computed planner-state at the end
    ui.plannerState(plan);
    // If the user previously sent an orchestrator-tagged message and this is a follow-up, do not keep planning again
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


