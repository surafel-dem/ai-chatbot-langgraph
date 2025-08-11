import type { ToolName, UiToolName } from '@/lib/ai/types';
import {
  GlobeIcon,
  Telescope,
  type LucideIcon,
  Images,
  Edit3,
} from 'lucide-react';

export interface ToolDefinition {
  name: string;
  description: string;
  icon: LucideIcon;
  key: ToolName;
}

export const toolDefinitions: Record<UiToolName, ToolDefinition> = {
  webSearch: {
    key: 'webSearch',
    name: 'Web Search',
    description: 'Search the web for real-time information.',
    icon: GlobeIcon,
  },
  deepResearch: {
    key: 'deepResearch',
    name: 'Deep Research',
    description: 'Get comprehensive analysis with citations.',
    icon: Telescope,
  },
  generateImage: {
    key: 'generateImage',
    name: 'Create an image',
    description: 'Generate images from text descriptions.',
    icon: Images,
  },
  createDocument: {
    key: 'createDocument',
    name: 'Write or code',
    description: 'Create documents, code, or run code in a sandbox.',
    icon: Edit3,
  },
};

export const enabledTools: UiToolName[] = [
  'webSearch',
  'deepResearch',
  'generateImage',
  'createDocument',
];
