import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const startStep = mutation({
  args: { run_id: v.id("runs"), role: v.string(), name: v.string() },
  handler: async (ctx, { run_id, role, name }) => {
    const stepId = await ctx.db.insert("steps", {
      run_id,
      role,
      name,
      started_at: Date.now(),
      token_in: 0,
      token_out: 0,
    });

    // increment run step count (best-effort)
    const run = await ctx.db.get(run_id);
    if (run) {
      await ctx.db.patch(run_id, { step_count: (run.step_count ?? 0) + 1 });
    }

    return stepId;
  },
});

export const endStep = mutation({
  args: {
    step_id: v.id("steps"),
    error: v.optional(v.string()),
    token_in: v.optional(v.number()),
    token_out: v.optional(v.number()),
  },
  handler: async (ctx, { step_id, error, token_in, token_out }) => {
    const step = await ctx.db.get(step_id);
    if (!step) return;

    await ctx.db.patch(step_id, {
      ended_at: Date.now(),
      error: error ?? undefined,
      ...(typeof token_in === 'number' ? { token_in } : {}),
      ...(typeof token_out === 'number' ? { token_out } : {}),
    });

    // accumulate into run
    const run = await ctx.db.get(step.run_id);
    if (run) {
      await ctx.db.patch(step.run_id, {
        token_in: (run.token_in ?? 0) + (token_in ?? 0),
        token_out: (run.token_out ?? 0) + (token_out ?? 0),
      });
    }
  },
});


