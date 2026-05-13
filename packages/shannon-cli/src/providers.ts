export type ProviderType = 'anthropic' | 'bedrock' | 'vertex' | 'custom';

export interface ProviderConfig {
  type: ProviderType;
  configured: boolean;
  validationError?: string;
}

export function detectProvider(): ProviderConfig {
  const candidates: Array<() => ProviderConfig> = [
    () => ({
      type: 'anthropic' as const,
      configured: !!process.env.ANTHROPIC_API_KEY,
      validationError: process.env.ANTHROPIC_API_KEY ? undefined : 'ANTHROPIC_API_KEY is not set',
    }),
    () => ({
      type: 'bedrock' as const,
      configured:
        process.env.CLAUDE_CODE_USE_BEDROCK === '1' &&
        !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_BEARER_TOKEN_BEDROCK),
      validationError: 'AWS credentials not configured for Bedrock',
    }),
    () => ({
      type: 'vertex' as const,
      configured: process.env.CLAUDE_CODE_USE_VERTEX === '1' && !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      validationError: 'GCP credentials not configured for Vertex',
    }),
    () => ({
      type: 'custom' as const,
      configured: !!process.env.ANTHROPIC_BASE_URL && !!process.env.ANTHROPIC_API_KEY,
      validationError: 'ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY must both be set for custom proxy',
    }),
  ];

  const configured = candidates.filter((c) => c().configured);

  if (configured.length === 0) {
    return {
      type: 'anthropic',
      configured: false,
      validationError:
        'No provider configured. Set ANTHROPIC_API_KEY (or CLAUDE_CODE_USE_BEDROCK=1, CLAUDE_CODE_USE_VERTEX=1, or ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY for custom proxy).',
    };
  }

  if (configured.length > 1) {
    return {
      type: configured[0]().type,
      configured: false,
      validationError: `Multiple providers detected (${configured.map((c) => c().type).join(', ')}). Configure exactly one.`,
    };
  }

  return configured[0]();
}
