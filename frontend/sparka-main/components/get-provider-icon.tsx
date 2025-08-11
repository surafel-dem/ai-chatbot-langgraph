'use client';
import type { ProviderId } from '@/providers/models-generated';
import {
  OpenAI,
  Anthropic,
  XAI,
  Gemini,
  Meta,
  Mistral,
  Alibaba,
  Cohere,
  DeepSeek,
  Perplexity,
  Vercel,
  Aws,
  Moonshot,
  ZAI,
} from '@lobehub/icons';

export function getProviderIcon(provider: ProviderId, size = 16) {
  const iconProps = { size };
  switch (provider) {
    case 'openai':
      return <OpenAI {...iconProps} />;
    case 'anthropic':
      return <Anthropic {...iconProps} />;
    case 'xai':
      return <XAI {...iconProps} />;
    case 'google':
      return <Gemini {...iconProps} />;
    case 'meta':
      return <Meta {...iconProps} />;
    case 'mistral':
      return <Mistral {...iconProps} />;
    case 'alibaba':
      return <Alibaba {...iconProps} />;
    case 'amazon':
      return <Aws {...iconProps} />;
    case 'cohere':
      return <Cohere {...iconProps} />;
    case 'deepseek':
      return <DeepSeek {...iconProps} />;
    case 'perplexity':
      return <Perplexity {...iconProps} />;
    case 'vercel':
      return <Vercel {...iconProps} />;
    case 'inception':
      return <OpenAI {...iconProps} />; // Using OpenAI as fallback
    case 'moonshotai':
      return <Moonshot {...iconProps} />;
    case 'morph':
      return <OpenAI {...iconProps} />; // Using OpenAI as fallback
    case 'zai':
      return <ZAI {...iconProps} />;
  }
}
