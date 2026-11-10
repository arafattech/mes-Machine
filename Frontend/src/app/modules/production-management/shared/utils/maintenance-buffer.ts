/** Post-maintenance verification buffer length bounds (minutes) — mirrors the backend validation. */
export const DEFAULT_BUFFER_MINUTES = 5;
export const MIN_BUFFER_MINUTES = 1;
export const MAX_BUFFER_MINUTES = 1440;

/** Reads a `ui5-step-input` change event, clamped to the allowed range. */
export function parseBufferMinutes(event: Event): number {
  const value = Math.round(Number((event.target as HTMLInputElement | null)?.value));
  return Number.isFinite(value)
    ? Math.min(MAX_BUFFER_MINUTES, Math.max(MIN_BUFFER_MINUTES, value))
    : DEFAULT_BUFFER_MINUTES;
}
