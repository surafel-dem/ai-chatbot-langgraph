import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const startRun = mutation({
  args: { chat_id: v.string(), user_id: v.string(), planner_state: v.optional(v.any()) },
  handler: async (ctx, { chat_id, user_id, planner_state }) => {
    const runId = await ctx.db.insert("runs", {
      chat_id,
      user_id,
      status: "running",
      step_count: 0,
      token_in: 0,
      token_out: 0,
      started_at: Date.now(),
      planner_state,
    });
    return runId;
  },
});

export const endRun = mutation({
  args: { run_id: v.id("runs"), error: v.optional(v.string()) },
  handler: async (ctx, { run_id, error }) => {
    await ctx.db.patch(run_id, {
      status: error ? "error" : "done",
      error: error ?? undefined,
      ended_at: Date.now(),
    });
  },
});


