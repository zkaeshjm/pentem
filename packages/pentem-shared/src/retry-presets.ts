export interface RetryPreset {
  maximumAttempts: number;
  initialInterval: string;
  maximumInterval: string;
  backoffCoefficient: number;
}

export const RETRY_PRESETS = {
  default: {
    maximumAttempts: 50,
    initialInterval: '5 minutes',
    maximumInterval: '30 minutes',
    backoffCoefficient: 2,
  },
  fast: {
    maximumAttempts: 5,
    initialInterval: '10 seconds',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
  },
  subscription: {
    maximumAttempts: 100,
    initialInterval: '10 seconds',
    maximumInterval: '6 hours',
    backoffCoefficient: 2,
  },
} as const satisfies Record<string, RetryPreset>;

export type RetryPresetName = keyof typeof RETRY_PRESETS;

export const NON_RETRYABLE_ERROR_TYPES = [
  'AUTH_FAILURE',
  'INVALID_CONFIG',
  'OUT_OF_MEMORY',
  'INVALID_TARGET_URL',
  'INVALID_CREDENTIALS',
] as const;

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Object && 'type' in error) {
    const type = (error as { type: string }).type;
    return !(NON_RETRYABLE_ERROR_TYPES as readonly string[]).includes(type);
  }
  if (error instanceof Error && 'cause' in error) {
    const cause = (error as { cause: unknown }).cause;
    return isRetryableError(cause);
  }
  return true;
}
