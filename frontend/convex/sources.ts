import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const addMany = mutation({
  args: { run_id: v.id("runs"), items: v.any() },
  handler: async (ctx, { run_id, items }) => {
    let order = 1;
    const list = (items as any[]) ?? [];
    for (const s of list) {
      await ctx.db.insert("sources", {
        run_id,
        url: s.url,
        title: s.title,
        snippet: s.snippet,
        meta: s.meta,
        order: order++,
      });
    }
  },
});


