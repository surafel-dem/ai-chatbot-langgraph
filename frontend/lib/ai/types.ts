import type { UIMessageStreamWriter } from 'ai';

// Stream writer type for car analysis tools
export type StreamWriter = UIMessageStreamWriter;

// Custom data types for car analysis updates
export type CarAnalysisUpdate = {
  title?: string;
  message?: string;
  type?: 'started' | 'thinking' | 'writing' | 'completed';
  status?: 'running' | 'completed' | 'error';
  timestamp?: number;
};

// Tool event types
export type ToolEvent =
  | { type: 'start'; name: string; input: unknown }
  | { type: 'result'; name: string; output: unknown };

// Source reference
export type Source = { 
  url: string; 
  title?: string; 
  snippet?: string; 
  meta?: any 
};