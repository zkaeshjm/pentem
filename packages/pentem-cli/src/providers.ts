import { detectFromEnvOrConfig } from './tui/services/providers-config.ts';

export type ProviderType = 'anthropic' | 'openai' | 'openai-compatible' | 'bedrock' | 'vertex' | 'custom';

export interface ProviderConfig {
  type: ProviderType;
  configured: boolean;
  validationError?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export function detectProvider(): ProviderConfig {
  const result = detectFromEnvOrConfig();

  if (!result.configured) {
    return {
      type: 'anthropic',
      configured: false,
      validationError: result.error || 'No provider configured.',
    };
  }

  return {
    type: result.provider as ProviderType,
    configured: true,
    apiKey: result.apiKey,
    baseUrl: result.baseUrl,
    model: result.model,
  };
}
