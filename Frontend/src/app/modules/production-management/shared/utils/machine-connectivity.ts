/** PLC communication health — independent of the operational state (node-server reports an
 * unreachable PLC as INACTIVE; the dashboards show both, never folding one into the other). */
export type MachineConnectivity = 'online' | 'stale' | 'unknown';

/** Matches node-server's `MQTT_STALENESS_MS` default: a reading older than this is stale. */
export const COMMS_STALE_MS = 15_000;

export interface MachineConnectivityMeta {
  label: string;
  icon: string;
  tagDesign: 'Positive' | 'Negative' | 'Neutral';
  /** SAP theme text colour, so the chip follows light/dark/high-contrast themes. */
  color: string;
}

export const MACHINE_CONNECTIVITY_META: Record<MachineConnectivity, MachineConnectivityMeta> = {
  online: { label: $localize`Online`, icon: 'connected', tagDesign: 'Positive', color: 'var(--sapPositiveTextColor)' },
  stale: { label: $localize`No signal`, icon: 'disconnected', tagDesign: 'Negative', color: 'var(--sapNegativeTextColor)' },
  unknown: {
    label: $localize`No reading yet`,
    icon: 'question-mark',
    tagDesign: 'Neutral',
    color: 'var(--sapContent_LabelColor)',
  },
};

/** `lastSeenAt` is the epoch ms of the PLC's last successful read (`to_frontend` telemetry);
 * `null` when no reading arrived this session (also the case in legacy worker mode). */
export function connectivityOf(lastSeenAt: number | null, now: number): MachineConnectivity {
  if (lastSeenAt == null) return 'unknown';
  return now - lastSeenAt <= COMMS_STALE_MS ? 'online' : 'stale';
}
