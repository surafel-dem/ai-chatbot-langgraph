import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const startStep = mutation({
  args: { run_id: v.id("runs"), role: v.string(), name: v.string() },
  handler: async (ctx, { run_id, role, name }) => {
    return await ctx.db.insert("steps", {
      run_id,
      role,
      name,
      started_at: Date.now(),
      token_in: 0,
      token_out: 0,
    });
  },
});

export const endStep = mutation({
  args: { step_id: v.id("steps"), error: v.optional(v.string()) },
  handler: async (ctx, { step_id, error }) => {
    await ctx.db.patch(step_id, {
      ended_at: Date.now(),
      error: error ?? undefined,
    });
  },
});

 