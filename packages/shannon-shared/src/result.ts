export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function Ok<T, E = Error>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function Err<T, E = Error>(error: E): Result<T, E> {
  return { ok: false, error };
}

export function errToString(err: unknown): string {
  if (err instanceof Error) {
    return err.message.slice(0, 2000);
  }
  return String(err).slice(0, 2000);
}
