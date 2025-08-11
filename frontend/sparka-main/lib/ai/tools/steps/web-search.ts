import { tavily, type TavilySearchOptions } from '@tavily/core';
import FirecrawlApp, { type SearchParams } from '@mendable/firecrawl-js';
import type { StreamWriter } from '../../types';

export type SearchProvider = 'tavily' | 'firecrawl';

export type SearchProviderOptions =
  | ({
      provider: 'tavily';
    } & Omit<TavilySearchOptions, 'limit'>)
  | ({
      provider: 'firecrawl';
    } & SearchParams);

export type WebSearchResult = {
  source: 'web';
  title: string;
  url: string;
  content: string;
};

export type WebSearchResponse = {
  results: WebSearchResult[];
  error?: string;
};

// Initialize search providers
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY as string });
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY ?? '',
});

export async function webSearchStep({
  query,
  maxResults,
  providerOptions,
  dataStream,
}: {
  query: string;
  maxResults: number;
  dataStream: StreamWriter;
  providerOptions: SearchProviderOptions;
}): Promise<WebSearchResponse> {
  try {
    let results: WebSearchResult[] = [];

    if (providerOptions.provider === 'tavily') {
      const response = await tvly.search(query, {
        searchDepth: providerOptions.searchDepth || 'basic',
        maxResults,
        includeAnswer: true,
        ...providerOptions,
      });

      results = response.results.map((r) => ({
        source: 'web',
        title: r.title,
        url: r.url,
        content: r.content,
      }));
    } else if (providerOptions.provider === 'firecrawl') {
      const response = await firecrawl.search(query, {
        timeout: providerOptions.timeout || 15000,
        limit: maxResults,
        scrapeOptions: { formats: ['markdown'] },
        ...providerOptions,
      });

      results = response.data.map((item) => ({
        source: 'web',
        title: item.title || '',
        url: item.url || '',
        content: item.markdown || '',
      }));
    }

    return { results };
  } catch (error: any) {
    console.error('Error in webSearchStep:', {
      error,
      message: error?.message,
      stack: error?.stack,
      query,
      providerOptions,
    });
    return {
      results: [],
      error: error.message,
    };
  }
}
