import { z } from 'zod';

export const specLookup = {
  description: 'Return high-level spec info for a car (engine/fuel/body)',
  parameters: z.object({ make: z.string(), model: z.string(), year: z.number().int().optional() }),
  execute: async ({ make, model, year }: { make: string; model: string; year?: number }) => {
    return { body: 'Hatchback', fuel: 'Petrol', transmission: 'Automatic', power_kw: 90, sources: [] };
  },
};


