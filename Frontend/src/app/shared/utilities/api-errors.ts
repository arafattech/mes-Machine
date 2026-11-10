import { HttpErrorResponse } from '@angular/common/http';

interface LaravelErrorBody {
  message?: unknown;
  errors?: Record<string, unknown[]>;
}

/** First human-readable message of a Laravel error response — its first field error, else `message`. */
export function apiErrorMessage(error: unknown): string | undefined {
  const body = (error as HttpErrorResponse | null)?.error as LaravelErrorBody | null | undefined;
  const firstFieldError = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
  if (typeof firstFieldError === 'string') return firstFieldError;
  return typeof body?.message === 'string' ? body.message : undefined;
}
