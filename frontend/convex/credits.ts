import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get user credits info (registered users only)
 */
export const getUserCreditsInfo = query({
  args: { user_id: v.id("users") },
  handler: async (ctx, { user_id }) => {
    const user = await ctx.db.get(user_id);
    if (!user) return null;

    const totalCredits = user.credits ?? 0;
    const reservedCredits = user.reserved_credits ?? 0;
    const availableCredits = totalCredits - reservedCredits;

    return {
      totalCredits,
      availableCredits,
      reservedCredits,
    };
  },
});

/**
 * Reserve available credits for an operation.
 * If available < minAmount, returns an error.
 */
export const reserveAvailableCredits = mutation({
  args: {
    user_id: v.id("users"),
    maxAmount: v.number(),
    minAmount: v.number(),
  },
  handler: async (ctx, { user_id, maxAmount, minAmount }) => {
    const user = await ctx.db.get(user_id);
    if (!user) return { success: false as const, error: "User not found" };

    const totalCredits = user.credits ?? 0;
    const reservedCredits = user.reserved_credits ?? 0;
    const available = totalCredits - reservedCredits;

    const amountToReserve = Math.min(maxAmount, available);
    if (amountToReserve < minAmount) {
      return { success: false as const, error: "Insufficient credits" };
    }

    await ctx.db.patch(user_id, {
      reserved_credits: reservedCredits + amountToReserve,
    });

    return { success: true as const, reservedAmount: amountToReserve };
  },
});

/**
 * Finalize credit usage: deduct actualAmount and release reservedAmount.
 */
export const finalizeCreditsUsage = mutation({
  args: {
    user_id: v.id("users"),
    reservedAmount: v.number(),
    actualAmount: v.number(),
  },
  handler: async (ctx, { user_id, reservedAmount, actualAmount }) => {
    const user = await ctx.db.get(user_id);
    if (!user) return;

    const totalCredits = user.credits ?? 0;
    const reservedCredits = user.reserved_credits ?? 0;

    await ctx.db.patch(user_id, {
      credits: totalCredits - actualAmount,
      reserved_credits: reservedCredits - reservedAmount,
    });
  },
});

/**
 * Release a reservation without deducting usage (e.g., on error/timeout).
 */
export const releaseReservedCredits = mutation({
  args: { user_id: v.id("users"), amount: v.number() },
  handler: async (ctx, { user_id, amount }) => {
    const user = await ctx.db.get(user_id);
    if (!user) return;

    const reservedCredits = user.reserved_credits ?? 0;
    await ctx.db.patch(user_id, {
      reserved_credits: reservedCredits - amount,
    });
  },
});


