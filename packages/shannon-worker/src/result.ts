export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function Ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function Err<T, E = Error>(error: E): Result<T, E> {
  return { ok: false, error };
}

export interface ClassifiedError {
  type: string;
  message: string;
  retryable: boolean;
}

const NON_RETRYABLE = ['AUTH_FAILURE', 'INVALID_CONFIG', 'OUT_OF_MEMORY', 'INVALID_TARGET_URL', 'INVALID_CREDENTIALS'];

export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof Error) {
    const errRecord = error as unknown as Record<string, unknown>;
    const type = typeof errRecord.type === 'string' ? errRecord.type : 'UNKNOWN';
    return {
      type,
      message: error.message.slice(0, 2000),
      retryable: !NON_RETRYABLE.includes(type),
    };
  }
  return { type: 'UNKNOWN', message: String(error).slice(0, 2000), retryable: true };
}
