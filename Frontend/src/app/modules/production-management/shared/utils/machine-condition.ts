import { factoryMidnight, formatDateTime, formatFactoryDateTime } from '@shared/utilities/date-format';

/**
 * Machine condition shared by the three `/mco` dashboards: maintenance (active / next / last) and
 * the temperature / RPM sensors. Pure functions over the API rows — no requests, no new rules.
 */

/** One `GET api/machine/maintenance` row (fields used here only). */
export interface MaintenanceRow {
  id: number;
  /** Naive factory wall-clock DATETIME serialized with a `Z` suffix (not a real UTC instant). */
  scheduled_start_at: string | null;
  reason: string | null;
  maintenance_note: string | null;
  /** Real UTC instants (`Carbon::now()` on the backend). */
  activated_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
}

export type MaintenanceSummary =
  | { kind: 'active'; reason: string; since: string; sinceMs: number }
  | { kind: 'scheduled'; reason: string; when: string; dueMs: number; overdue: boolean }
  | { kind: 'none' };

export interface LastMaintenance {
  reason: string;
  endedAt: string;
  durationSeconds: number;
}

/** Sensor limits from `machine_has_configs` (all optional; most machines have none set). */
export interface SensorLimits {
  minTemp: number | null;
  maxTemp: number | null;
  minRpm: number | null;
  maxRpm: number | null;
}

export interface SensorReading {
  value: number;
  atMs: number;
}

export type SensorStatus = 'normal' | 'high' | 'low' | 'unknown';

/** Epoch ms of a naive factory wall-clock DATETIME (`2026-10-22T19:25:00Z` = 19:25 at the factory). */
function naiveFactoryMs(value: string): number {
  const date = new Date(value);
  const key = date.toISOString().slice(0, 10);
  return factoryMidnight(key).getTime() + (date.getUTCHours() * 60 + date.getUTCMinutes()) * 60_000;
}

/**
 * What matters right now: a running maintenance, else the next scheduled one, else nothing. A schedule
 * row that is still open counts as running only while the machine really is in the Maintenance state —
 * after the machine has recovered (e.g. inside the verification buffer, or if the row was never closed)
 * the next scheduled maintenance is what is worth showing.
 */
export function summarizeMaintenance(rows: MaintenanceRow[], machineInMaintenance: boolean): MaintenanceSummary {
  const active = machineInMaintenance ? rows.find((r) => r.activated_at && !r.ended_at) : undefined;
  if (active?.activated_at) {
    return {
      kind: 'active',
      reason: active.reason || $localize`No reason given`,
      since: formatFactoryDateTime(active.activated_at),
      sinceMs: Date.parse(active.activated_at),
    };
  }
  const next = rows
    .filter((r) => !r.activated_at && !r.ended_at && r.scheduled_start_at)
    .map((r) => ({ row: r, dueMs: naiveFactoryMs(r.scheduled_start_at as string) }))
    .sort((a, b) => a.dueMs - b.dueMs)[0];
  if (next) {
    return {
      kind: 'scheduled',
      reason: next.row.reason || $localize`No reason given`,
      when: formatDateTime(next.row.scheduled_start_at),
      dueMs: next.dueMs,
      overdue: next.dueMs < Date.now(),
    };
  }
  return { kind: 'none' };
}

export function lastMaintenance(rows: MaintenanceRow[]): LastMaintenance | null {
  const last = rows
    .filter((r) => r.ended_at)
    .sort((a, b) => Date.parse(b.ended_at as string) - Date.parse(a.ended_at as string))[0];
  if (!last?.ended_at) return null;
  const fallback = last.activated_at ? (Date.parse(last.ended_at) - Date.parse(last.activated_at)) / 1000 : 0;
  return {
    reason: last.maintenance_note || last.reason || $localize`No reason given`,
    endedAt: formatFactoryDateTime(last.ended_at),
    durationSeconds: Math.max(0, Math.round(last.duration_seconds ?? fallback)),
  };
}

/** "in 3 d 4 h" / "in 2 h 10 min" / "overdue" — coarse on purpose, for a glance. */
export function dueText(dueMs: number, nowMs: number): string {
  const minutes = Math.round((dueMs - nowMs) / 60_000);
  if (minutes <= 0) return $localize`overdue`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return $localize`in ${days} d ${hours} h`;
  return hours > 0 ? $localize`in ${hours} h ${minutes % 60} min` : $localize`in ${minutes} min`;
}

export function sensorStatus(value: number | null, min: number | null, max: number | null): SensorStatus {
  if (value === null) return 'unknown';
  if (max !== null && value > max) return 'high';
  if (min !== null && value < min) return 'low';
  return 'normal';
}

export function limitsText(min: number | null, max: number | null, unit: string): string {
  if (min === null && max === null) return $localize`No limits set`;
  if (min !== null && max !== null) return `${min}–${max} ${unit}`;
  return max !== null ? $localize`max ${max} ${unit}` : $localize`min ${min} ${unit}`;
}
