import { api } from '@/convex/_generated/api';

export async function startStep(convex: any, { runId, role, name }: any) {
  return convex.mutation(api.steps.startStep, { run_id: runId, role, name });
}
export async function endStep(convex: any, { stepId, error }: any) {
  return convex.mutation(api.steps.endStep, { step_id: stepId, error });
}
export async function addSources(convex: any, { runId, items }: any) {
  return convex.mutation(api.sources.addMany, { run_id: runId, items });
}
export async function toolStart(convex: any, { stepId, name, input }: any) {
  return convex.mutation(api.tool_calls.start, { step_id: stepId, name, input });
}
export async function toolEnd(convex: any, { tool_call_id, output }: any) {
  return convex.mutation(api.tool_calls.end, { tool_call_id, output });
}

 