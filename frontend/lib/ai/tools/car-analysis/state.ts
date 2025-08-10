import { z } from 'zod';
import type { ModelMessage, ToolCall } from 'ai';

// Car analysis result types
export type CarAnalysisResult =
  | { type: 'report'; data: any }
  | { type: 'clarifying_question'; data: string };

// Input state for starting analysis
export interface AnalysisInputState {
  requestId: string;
  messages: ModelMessage[];
}

// Clarification schemas
export const ClarifyWithUserSchema = z.object({
  need_clarification: z.boolean().describe('Whether clarification is needed from the user'),
  question: z.string().optional().describe('The clarification question to ask the user'),
});

// Car details schema
export const CarDetailsSchema = z.object({
  make: z.string().describe('Car make/manufacturer'),
  model: z.string().describe('Car model'),
  year: z.number().int().describe('Car year'),
  body_type: z.string().optional().describe('Body type (sedan, SUV, hatchback, etc.)'),
  engine: z.string().optional().describe('Engine type (petrol, diesel, hybrid, electric)'),
  budget: z.string().optional().describe('Budget considerations if mentioned'),
});

// Specialist analysis schemas
export const SpecialistToolsSchema = z.object({
  specialist_type: z.enum(['purchase_advice', 'running_costs', 'reliability']),
});

// Supervisor tool schemas for orchestrating specialists
export const SupervisorToolsInput = z.object({
  analyze_purchase: z.object({
    car_details: CarDetailsSchema,
    analysis_brief: z.string(),
  }).optional(),
  analyze_running_costs: z.object({
    car_details: CarDetailsSchema,
    analysis_brief: z.string(),
  }).optional(),
  analyze_reliability: z.object({
    car_details: CarDetailsSchema,
    analysis_brief: z.string(),
  }).optional(),
  analysis_complete: z.object({
    summary: z.string(),
  }).optional(),
});

// Main state interfaces
export interface AgentState {
  requestId: string;
  inputMessages: ModelMessage[];
  supervisor_messages: ModelMessage[];
  car_details?: z.infer<typeof CarDetailsSchema>;
  analysis_brief?: string;
  purchase_analysis?: string;
  running_cost_analysis?: string;
  reliability_analysis?: string;
  raw_notes: string[];
  notes: string[];
  final_report: string;
  reportResult: {
    id: string;
    title: string;
    kind: string;
    content: string;
  };
}

// Supervisor state types
export interface SupervisorState {
  requestId: string;
  supervisor_messages: ModelMessage[];
  analysis_brief: string;
  car_details: z.infer<typeof CarDetailsSchema>;
  notes: string[];
  analysis_iterations: number;
  raw_notes: string[];
  tool_calls: ToolCall[];
}

export interface SupervisorInput extends SupervisorState {}

export interface SupervisorOutput {
  supervisor_messages: ModelMessage[];
  tool_calls: ToolCall[];
  analysis_iterations: number;
}

export interface SupervisorToolsInput {
  requestId: string;
  supervisor_messages: ModelMessage[];
  analysis_brief: string;
  car_details: z.infer<typeof CarDetailsSchema>;
  analysis_iterations: number;
  tool_calls: ToolCall[];
}

export interface SupervisorToolsOutput {
  supervisor_messages: ModelMessage[];
  raw_notes: string[];
}

// Specialist state types
export interface SpecialistState {
  requestId: string;
  specialist_messages: ModelMessage[];
  tool_calls: ToolCall[];
  analysis_topic: string;
  car_details: z.infer<typeof CarDetailsSchema>;
  tool_call_iterations: number;
  compressed_analysis: string;
  raw_notes: string[];
}

export interface SpecialistInput extends SpecialistState {}

export interface CompressAnalysisInput {
  requestId: string;
  specialist_messages: ModelMessage[];
}

export interface SpecialistOutputState {
  compressed_analysis: string;
  raw_notes: string[];
}

// Input state types
export type ClarifyWithUserInput = AnalysisInputState;
export type WriteAnalysisBriefInput = AnalysisInputState;
export type WriteAnalysisBriefOutput = {
  analysis_brief: string;
  car_details: z.infer<typeof CarDetailsSchema>;
  title: string;
};

// Tool definitions for supervisor
export const supervisorTools = {
  analyze_purchase: {
    description: 'Analyze purchase advice for the specified car',
    parameters: z.object({
      analysis_topic: z.string().describe('Specific purchase analysis focus'),
    }),
    execute: async (args: any) => args,
  },
  analyze_running_costs: {
    description: 'Analyze running costs for the specified car',
    parameters: z.object({
      analysis_topic: z.string().describe('Specific running cost analysis focus'),
    }),
    execute: async (args: any) => args,
  },
  analyze_reliability: {
    description: 'Analyze reliability for the specified car',
    parameters: z.object({
      analysis_topic: z.string().describe('Specific reliability analysis focus'),
    }),
    execute: async (args: any) => args,
  },
  analysis_complete: {
    description: 'Mark the car analysis as complete',
    parameters: z.object({
      summary: z.string().describe('Summary of completed analysis'),
    }),
    execute: async (args: any) => args,
  },
};

export type ResponseMessage = {
  role: 'tool';
  content: Array<{
    toolName: string;
    toolCallId: string;
    type: 'tool-result';
    output: {
      type: 'text';
      value: string;
    };
  }>;
};