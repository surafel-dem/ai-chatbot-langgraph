import { z } from 'zod';

type WebResult = { title: string; url: string; snippet?: string };
const TAVILY = process.env.TAVILY_API_KEY;

export const webSearch = {
  description: 'Search the web for up-to-date info',
  parameters: z.object({ q: z.string(), k: z.number().min(1).max(5).default(3) }),
  execute: async ({ q, k }: { q: string; k: number }) => {
    if (TAVILY) {
      try {
        const resp = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TAVILY}`,
          },
          body: JSON.stringify({ query: q, max_results: k }),
        });
        const data = await resp.json().catch(() => ({}));
        const results: WebResult[] =
          data?.results?.slice(0, k).map((r: any) => ({ title: r.title, url: r.url, snippet: r.content })) ?? [];
        return { results };
      } catch (e) {
        return { results: [] };
      }
    }
    return { results: [] };
  },
};


