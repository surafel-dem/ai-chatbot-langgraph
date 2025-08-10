import type { CarAnalysisConfig } from './configuration';
import type { ModelId } from '@/lib/ai/model-id';
import type { StreamWriter } from '@/lib/ai/types';
import { webSearch } from '../webSearch';
import { priceLookup } from '../priceLookup';
import { specLookup } from '../specLookup';

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function getModelContextWindow(modelId: ModelId): number {
  // Model context windows - simplified for now
  switch (modelId) {
    case 'gpt-4o':
    case 'gpt-4o-2024-08-06':
      return 128000;
    case 'gpt-4o-mini':
      return 128000;
    case 'claude-3-5-sonnet-20241022':
      return 200000;
    case 'claude-3-5-haiku-20241022':  
      return 200000;
    default:
      return 32000; // Conservative default
  }
}

export async function getAllTools(
  config: CarAnalysisConfig,
  dataStream: StreamWriter,
  requestId: string,
) {
  const tools: Record<string, any> = {};

  try {
    // Add car analysis specific tools
    tools.webSearch = {
      ...webSearch,
      execute: async (args: any) => {
        return webSearch.execute(args);
      },
    };

    tools.priceLookup = {
      ...priceLookup,
      execute: async (args: any) => {
        return priceLookup.execute(args);
      },
    };

    tools.specLookup = {
      ...specLookup,
      execute: async (args: any) => {
        return specLookup.execute(args);
      },
    };
  } catch (error) {
    console.error('Error loading car analysis tools:', error);
  }

  return tools;
}

export function getNotesFromToolCalls(messages: any[]): string[] {
  const notes: string[] = [];
  
  for (const message of messages) {
    if (message.role === 'tool') {
      const content = Array.isArray(message.content) 
        ? message.content.map((c: any) => c.output?.value || c.text || '').join(' ')
        : String(message.content || '');
      if (content.length > 50) { // Only include substantial tool outputs
        notes.push(content);
      }
    } else if (message.role === 'assistant') {
      const content = Array.isArray(message.content)
        ? message.content.map((c: any) => c.text || '').join(' ')
        : String(message.content || '');
      if (content.length > 100) { // Only include substantial assistant responses
        notes.push(content);
      }
    }
  }
  
  return notes;
}

export function extractCarDetailsFromMessages(messages: any[]): {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
} {
  const allText = messages
    .filter((m) => m.role === 'user')
    .map((m) => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) {
        return m.content.map((c: any) => c.text || '').join(' ');
      }
      return '';
    })
    .join(' ')
    .toLowerCase();

  // Extract year
  const yearMatch = allText.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : undefined;

  // Extract basic car details - this is a simplified version
  // In a real implementation, you'd want more sophisticated NLP
  const carBrands = ['bmw', 'mercedes', 'audi', 'toyota', 'honda', 'ford', 'volkswagen', 'vw', 'nissan', 'hyundai', 'kia', 'mazda', 'volvo', 'skoda', 'seat'];
  
  let make: string | undefined;
  for (const brand of carBrands) {
    if (allText.includes(brand)) {
      make = brand === 'vw' ? 'volkswagen' : brand;
      break;
    }
  }

  // Extract model (simplified - would need more sophisticated logic in production)
  const tokens = allText.split(/\s+/);
  let model: string | undefined;
  
  if (make) {
    const makeIndex = tokens.findIndex(token => token.includes(make));
    if (makeIndex !== -1 && makeIndex + 1 < tokens.length) {
      // Look for model after make
      const nextToken = tokens[makeIndex + 1];
      if (nextToken && !yearMatch?.[0]?.includes(nextToken)) {
        model = nextToken;
      }
    }
  }

  // Extract engine type
  const engineTypes = ['petrol', 'diesel', 'hybrid', 'electric', 'ev'];
  let engine: string | undefined;
  for (const engineType of engineTypes) {
    if (allText.includes(engineType)) {
      engine = engineType;
      break;
    }
  }

  return { make, model, year, engine };
}

export function generateAnalysisTitle(carDetails: {
  make?: string;
  model?: string;
  year?: number;
}): string {
  const { make, model, year } = carDetails;
  
  if (make && model && year) {
    return `${year} ${make.charAt(0).toUpperCase() + make.slice(1)} ${model.charAt(0).toUpperCase() + model.slice(1)} - Comprehensive Analysis`;
  } else if (make && model) {
    return `${make.charAt(0).toUpperCase() + make.slice(1)} ${model.charAt(0).toUpperCase() + model.slice(1)} - Car Analysis`;
  } else if (make) {
    return `${make.charAt(0).toUpperCase() + make.slice(1)} - Car Analysis`;
  } else {
    return 'Car Analysis Report';
  }
}