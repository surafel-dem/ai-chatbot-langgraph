import { streamText } from 'ai';
import { getModel } from '../model';
import { PLANNER_SYSTEM } from '../prompts/planner';

export async function plannerAgent(ctx: any) {
  const result: any = await streamText({
    model: getModel(ctx.selectedChatModel),
    system: PLANNER_SYSTEM,
    messages: ctx.messages,
  });

  return {
    textStream: result.textStream,
    toolEvents: (async function* () {})(),
    sources: [],
  };
}

 