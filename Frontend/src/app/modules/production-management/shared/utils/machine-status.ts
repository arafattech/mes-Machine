import { MachineActivityType } from '@production-module/shared/utils/types';

/** Fields on a socket telemetry payload used to derive machine activity. */
export interface MachineStatusSignals {
  STATUS?: string;
  A?: number;
  P?: number;
}

/**
 * Derive a machine's activity from a telemetry payload.
 * Channel mapping mode sends an explicit `STATUS` — an admin-defined `machine_states.name`,
 * not one of a fixed set, so it's passed through as-is (just uppercased for display
 * consistency). The legacy worker payload has no state config to derive an arbitrary name
 * from, so it stays mapped from the raw `A` (active) / `P` (production) flags to this
 * fixed 3-value subset — a documented boundary, not an oversight (see node-server's
 * `MachineRuntimeService.deriveLegacyState`, the same boundary on the write side).
 */
export function deriveActivity(
  data?: MachineStatusSignals | null,
): MachineActivityType {
  if (!data) return 'INACTIVE';

  if (data.STATUS) return String(data.STATUS).toUpperCase();

  if (Number(data.A) === 1) return 'ACTIVE';
  if (Number(data.P) === 1) return 'IDLE';
  return 'INACTIVE';
}
