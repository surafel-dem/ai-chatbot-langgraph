export interface CarAnalysisConfig {
  // Model configuration
  analysis_model: string;
  analysis_model_max_tokens: number;
  compression_model: string;
  compression_model_max_tokens: number;
  final_report_model: string;
  final_report_model_max_tokens: number;

  // Analysis flow control
  allow_clarification: boolean;
  max_specialist_iterations: number;
  max_concurrent_specialists: number;

  // Tool configuration
  web_search_max_queries: number;
}

export function createCarAnalysisConfig(): CarAnalysisConfig {
  return {
    // Model configuration - using same models as deep research
    analysis_model: 'gpt-4o',
    analysis_model_max_tokens: 4000,
    compression_model: 'gpt-4o-mini',
    compression_model_max_tokens: 2000,
    final_report_model: 'gpt-4o',
    final_report_model_max_tokens: 8000,

    // Analysis flow control
    allow_clarification: true,
    max_specialist_iterations: 3,
    max_concurrent_specialists: 3, // All 3 specialists can run concurrently

    // Tool configuration
    web_search_max_queries: 5,
  };
}