import { DestroyRef, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, interval } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { SocketService } from '@app/services/socket.service';
import { MachineStatesService } from '@app/modules/production-management/shared/services/machine-states.service';
import { MS_PER_DAY, factoryDayStart } from '@shared/utilities/date-format';

/** Per-state accumulated durations for one machine, in seconds — keyed by
 * `machine_states.id`, not a fixed Active/Idle/Inactive/Maintenance/Fault set. */
export interface MachineDurations {
  /** Today's full accumulated seconds per state (includes earlier same-day visits) —
   * for the State Durations panel's per-state totals. */
  perState: Partial<Record<number, number>>;
  current: number | null;
  /** Live elapsed seconds since the *current* state was entered only — resets to 0 on
   * every transition, unlike `perState[current]` which keeps adding to today's total.
   * For a card's "time in this status" timer. */
  currentSeconds: number;
  total: number;
  /** Epoch ms this machine's PLC last actually responded — from the per-tick
   * `to_frontend` broadcast, independent of `current`'s state name. `null` until at
   * least one live reading has been seen this session. */
  lastSeenAt: number | null;
}

interface MachineDurationEntry {
  state: number | null; // machine_state_id
  since: number; // epoch ms the current state was entered — may be before today
  base: Record<number, number>; // accumulated ms of closed intervals within today, by machine_state_id
}

export interface MachineStateEventRow {
  machine_id: number | string;
  machine_state_id: number | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

/** Server-computed status transition, pushed once per actual state change. */
interface MachineStatusRuntimeEvent {
  machine_id: number | string;
  machine_state_id: number;
  status: string;
  status_started_at: string;
  elapsed_seconds: number;
}

/** A post-maintenance verification window broke (re-triggered before the
 * deadline) — move `[since, until)` from `from_state_id`'s bucket to
 * `to_state_id`'s in today's totals. That span was genuinely Active in real
 * time (already recorded that way, correctly), but since the recovery
 * turned out false it belongs to Maintenance in the "today" totals instead.
 * Always arrives after the corresponding `machine_status_runtime` MAINTENANCE
 * transition for the same machine (Socket.IO preserves per-connection emit
 * order), so it corrects a value that has already been baked into `base[]`. */
interface MachineMaintenanceRecountEvent {
  machine_id: number | string;
  from_state_id: number;
  to_state_id: number;
  since: string;
  until: string;
}

const ZERO_SNAPSHOT: MachineDurations = {
  perState: {},
  current: null,
  currentSeconds: 0,
  total: 0,
  lastSeenAt: null,
};

/** Per-machine payload shape read off the batched `to_frontend` broadcast —
 * only the fields this service cares about. `STATUS` (channel-mapping mode
 * only) is the same state name node-server just resolved this tick — used as
 * a self-heal fallback, see `subscribeSocket`. */
interface FrontendTelemetryItem {
  MNR: string | number;
  STATUS?: string;
  lastSeenAt?: number | null;
}

/**
 * Tracks each machine's live per-state durations — dynamic, one bucket per
 * `machine_states.id` actually observed, not a fixed 5-value set.
 *
 * Root singleton so totals accumulate continuously across route changes. Seeds
 * the current day's totals from `machine_state_events`, then keeps them live
 * from the `machine_status_runtime` socket stream (server-computed, pushed on
 * each actual state transition). Consumers read `snapshot(key)` and depend on
 * `tick()` to refresh every second.
 */
@Injectable({ providedIn: 'root' })
export class MachineDurationService {
  readonly tick = signal(0);

  private readonly states = new Map<string, MachineDurationEntry>();
  private readonly lastSeen = new Map<string, number>();
  /** Epoch ms of the factory midnight opening "today"; every today-total is clipped to it. */
  private dayStartMs = factoryDayStart().getTime();

  constructor(
    private readonly socket: SocketService,
    private readonly common: CommonService,
    private readonly machineStates: MachineStatesService,
    private readonly destroyRef: DestroyRef,
  ) {
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.rolloverIfNewDay();
        this.tick.update((v) => v + 1);
      });

    // Seed today's totals first so a late socket tick cannot clobber history.
    this.seed().finally(() => this.subscribeSocket());
  }

  /** Live per-state durations (seconds) for a machine key (`String(MNR)`). */
  snapshot(key: string | null | undefined): MachineDurations {
    this.rolloverIfNewDay();
    const entry = key ? this.states.get(key) : undefined;
    if (!entry) {
      const lastSeenAt = key ? this.lastSeen.get(key) ?? null : null;
      return lastSeenAt === null ? ZERO_SNAPSHOT : { ...ZERO_SNAPSHOT, lastSeenAt };
    }

    const now = Date.now();
    const perState: Record<number, number> = {};
    for (const [stateId, ms] of Object.entries(entry.base)) {
      perState[Number(stateId)] = Math.floor(ms / 1000);
    }
    // The current state's *today total* adds only its part since factory midnight to
    // today's closed intervals. `currentSeconds` is the continuous time since the state
    // was entered (may span days) — the card's "In state for" timer.
    let currentSeconds = 0;
    if (entry.state !== null) {
      currentSeconds = Math.floor(Math.max(0, now - entry.since) / 1000);
      perState[entry.state] = (perState[entry.state] ?? 0) + Math.floor(this.msSinceDayStart(entry.since, now) / 1000);
    }

    const total = Object.values(perState).reduce((sum, seconds) => sum + seconds, 0);
    const lastSeenAt = key ? this.lastSeen.get(key) ?? null : null;
    return { perState, current: entry.state, currentSeconds, total, lastSeenAt };
  }

  private subscribeSocket(): void {
    this.socket
      .on('machine_status_runtime')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: MachineStatusRuntimeEvent) => {
        if (data?.machine_id == null || data?.machine_state_id == null) return;
        const startedMs = Date.parse(data.status_started_at);
        this.apply(
          String(data.machine_id),
          data.machine_state_id,
          Number.isFinite(startedMs) ? startedMs : Date.now(),
        );
      });

    // Post-maintenance verification window broke — correct today's totals,
    // moving the falsely-Active span into Maintenance. See
    // MachineMaintenanceRecountEvent's doc comment.
    this.socket
      .on('machine_maintenance_recount')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: MachineMaintenanceRecountEvent) => {
        if (data?.machine_id == null) return;
        const sinceMs = Date.parse(data.since);
        const untilMs = Date.parse(data.until);
        if (!Number.isFinite(sinceMs) || !Number.isFinite(untilMs)) return;

        this.rolloverIfNewDay();
        const ms = this.msSinceDayStart(sinceMs, untilMs);
        const entry = this.getEntry(String(data.machine_id));
        entry.base[data.from_state_id] = Math.max(0, (entry.base[data.from_state_id] ?? 0) - ms);
        entry.base[data.to_state_id] = (entry.base[data.to_state_id] ?? 0) + ms;
      });

    // Batched per-tick telemetry (fires every tick regardless of state transitions) —
    // the only source for "last time this PLC actually responded". Also a self-heal
    // fallback for `current`: `machine_status_runtime` only fires once, on a change, so
    // a missed emission (reconnect gap, node-server restart resetting its in-memory
    // last-state) would otherwise leave `current` stuck on a stale value forever, unlike
    // the board's own status tiles, which read this same per-tick `STATUS` directly and
    // so self-correct every second. `apply()` already no-ops when already in sync.
    this.socket
      .on('to_frontend')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: FrontendTelemetryItem | FrontendTelemetryItem[]) => {
        const items = Array.isArray(data) ? data : [data];
        const now = Date.now();
        for (const item of items) {
          if (item?.MNR == null) continue;
          const key = String(item.MNR);
          if (item.lastSeenAt != null) {
            this.lastSeen.set(key, item.lastSeenAt);
          }
          const resolvedStateId = item.STATUS ? this.machineStates.getByName(item.STATUS)?.id : undefined;
          if (resolvedStateId != null) {
            this.apply(key, resolvedStateId, now);
          }
        }
      });
  }

  /** Close the previous state's interval and start the new one. */
  private apply(key: string, stateId: number, now: number): void {
    // Roll over first, so a segment closed just after midnight only keeps its post-midnight part.
    this.rolloverIfNewDay();
    const entry = this.states.get(key);
    if (!entry) {
      this.states.set(key, { state: stateId, since: now, base: {} });
      return;
    }
    if (entry.state === stateId) return;
    if (entry.state !== null) {
      entry.base[entry.state] = (entry.base[entry.state] ?? 0) + this.msSinceDayStart(entry.since, now);
    }
    entry.state = stateId;
    entry.since = now;
  }

  private async seed(): Promise<void> {
    const midnightIso = new Date(this.dayStartMs).toISOString();

    // Two independent queries: the open-row anchor (current state) must not
    // depend on the datetime literal that the accumulated-totals query needs.
    const [open, closed] = await Promise.allSettled([
      firstValueFrom(
        this.common.get<{ value: MachineStateEventRow[] }>(
          `MachineStateEvents?$filter=ended_at eq null`,
        ),
      ),
      firstValueFrom(
        this.common.get<{ value: MachineStateEventRow[] }>(
          `MachineStateEvents?$filter=ended_at gt ${midnightIso}`,
        ),
      ),
    ]);

    // Today's accumulated totals per state: closed intervals ending after midnight,
    // clipped so a segment that began yesterday only counts its part since midnight.
    if (closed.status === 'fulfilled') {
      for (const row of closed.value?.value ?? []) {
        if (row.machine_state_id == null || !row.ended_at) continue;
        const entry = this.getEntry(String(row.machine_id));
        entry.base[row.machine_state_id] =
          (entry.base[row.machine_state_id] ?? 0) +
          this.msSinceDayStart(Date.parse(row.started_at), Date.parse(row.ended_at));
      }
    }

    // Current state anchored to the DB entry timestamp (survives reload).
    if (open.status === 'fulfilled') {
      for (const row of open.value?.value ?? []) {
        if (row.machine_state_id == null) continue;
        const startedMs = Date.parse(row.started_at);
        const entry = this.getEntry(String(row.machine_id));
        entry.state = row.machine_state_id;
        entry.since = Number.isFinite(startedMs) ? startedMs : Date.now();
      }
    }
  }

  private getEntry(key: string): MachineDurationEntry {
    let entry = this.states.get(key);
    if (!entry) {
      entry = { state: null, since: Date.now(), base: {} };
      this.states.set(key, entry);
    }
    return entry;
  }

  /** Length of `[fromMs, toMs)` that falls within today (after factory midnight). */
  private msSinceDayStart(fromMs: number, toMs: number): number {
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
    return Math.max(0, toMs - Math.max(fromMs, this.dayStartMs));
  }

  /**
   * At factory midnight, reset the accumulated (non-current) totals. `since` is kept so
   * "In state for" stays continuous; the current state's today total restarts from
   * midnight through `msSinceDayStart`. Checked on every read/write, not only on the
   * 1 s tick (throttled in background tabs); the common path is one comparison.
   */
  private rolloverIfNewDay(): void {
    if (Date.now() < this.dayStartMs + MS_PER_DAY) return;
    this.dayStartMs = factoryDayStart().getTime();

    for (const entry of this.states.values()) {
      entry.base = {};
    }
  }
}
