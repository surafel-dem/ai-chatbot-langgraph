import { z } from 'zod';

export const priceLookup = {
  description: 'Estimate price bands for a given car in Ireland',
  parameters: z.object({ make: z.string(), model: z.string(), year: z.number().int().optional() }),
  execute: async ({ make, model, year }: { make: string; model: string; year?: number }) => {
    const base = 15000;
    const variance = year ? Math.max(0, new Date().getFullYear() - year) * 500 : 2000;
    return {
      currency: 'EUR',
      used_low: base - variance,
      used_high: base + variance,
      new_msrp_est: base + 8000,
      sources: [],
    };
  },
};


