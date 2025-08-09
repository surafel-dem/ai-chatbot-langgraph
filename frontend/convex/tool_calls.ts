import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const start = mutation({
  args: { step_id: v.id("steps"), name: v.string(), input: v.optional(v.any()) },
  handler: async (ctx, { step_id, name, input }) => {
    const toolId = await ctx.db.insert("tool_calls", {
      step_id,
      name,
      input,
      started_at: Date.now(),
    });
    return toolId;
  },
});

export const end = mutation({
  args: { tool_call_id: v.id("tool_calls"), output: v.optional(v.any()) },
  handler: async (ctx, { tool_call_id, output }) => {
    await ctx.db.patch(tool_call_id, { output, ended_at: Date.now() });
  },
});


