import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { socketService } from 'config/socket/socket.config';
import { MaintenanceOverrideService } from './maintenance-override.service';

/**
 * Legacy ENUM values `machine_state_events.state` still accepts — kept in
 * sync best-effort alongside the authoritative `machine_state_id` FK for any
 * resolved state whose name happens to match one of these (case-insensitive).
 * A custom admin-defined state (e.g. "Changeover") has no slot here and
 * leaves `state` NULL — `machine_state_id` is the only column that matters
 * going forward; `state` is dropped entirely once verified.
 */
const LEGACY_STATE_VALUES = new Set(['active', 'inactive', 'maintenance', 'idle', 'fault']);

function toLegacyState(stateName: string): string | null {
  const lower = stateName.trim().toLowerCase();
  return LEGACY_STATE_VALUES.has(lower) ? lower : null;
}

/** One open `machine_maintenance_schedules` row currently in its post-maintenance
 * verification buffer (`pending_confirm_until IS NOT NULL`). `bufferMs` is that
 * row's own operator-chosen window length (`buffer_minutes`), not the shared
 * env-var default — see `MachineStateTrackerService.loadPendingConfirmations`. */
export type PendingConfirmation = {
  scheduleId: bigint;
  pendingConfirmUntil: Date;
  bufferMs: number;
};

/**
 * Shared `machine_state_events` write path + `machine_status_runtime` broadcast,
 * used by both `ChannelMappingService` (channel-mapping mode) and
 * `MachineRuntimeService` (legacy per-machine worker mode) so both acquisition
 * pipelines persist and broadcast state transitions identically.
 */
@Injectable()
export class MachineStateTrackerService {
  private readonly logger = new Logger(MachineStateTrackerService.name);

  // Fallback post-maintenance verification window, used only when a row has
  // no `buffer_minutes` of its own (rows activated before that column
  // existed) — every row activated through the "Activate now" dialog now
  // carries its own operator-chosen window instead of this shared default.
  // See `clearMaintenanceOverride` / `loadPendingConfirmations`.
  private readonly defaultVerificationBufferMs = Number(
    process.env.MAINTENANCE_VERIFICATION_BUFFER_MS ?? 5 * 60 * 1000,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceOverride: MaintenanceOverrideService,
  ) {}

  /**
   * Tells the frontend's `MachineDurationService` (the fleet-wide "STATE
   * DURATIONS (TODAY)" widget, which knows nothing about maintenance
   * sessions — it just sums `machine_state_events`) to move a span of time
   * from one state's bucket to another for one machine. Used only when a
   * post-maintenance verification window breaks (`ChannelMappingService`'s
   * `applyPendingConfirmationBuffer`): the window was genuinely recorded as
   * Active in real time (correctly — the board showed it truthfully), but
   * since the recovery turned out false, that span belongs to Maintenance
   * instead in the widget's totals, same attribution as
   * `machine_maintenance_schedules.duration_seconds`. Emitted by the caller
   * strictly after this tick's `machine_status_runtime` MAINTENANCE
   * transition, so the frontend's normal transition handling runs first and
   * this correction lands on top of it, not before it.
   */
  emitMaintenanceRecount(
    machineId: string,
    fromStateId: number,
    toStateId: number,
    since: Date,
    until: Date,
  ): void {
    socketService.emit('machine_maintenance_recount', {
      machine_id: machineId,
      from_state_id: fromStateId,
      to_state_id: toStateId,
      since: since.toISOString(),
      until: until.toISOString(),
    });
  }

  /**
   * Close the machine's currently-open state row (set ended_at + duration) and
   * open a new one for `machineStateId`. Idempotent and authoritative: reads
   * the open row from the DB, so it survives restarts without a spurious
   * duplicate when the state is unchanged. Broadcasts `machine_status_runtime`
   * once persisted.
   *
   * Throws on failure so the caller can invalidate its own last-state cache
   * (retry on next tick/signal) — this method does not swallow errors itself.
   */
  async recordTransition(
    machineId: string,
    machineStateId: number,
    stateName: string,
    now: Date,
  ): Promise<void> {
    const id = this.parseMachineId(machineId);
    if (id === null) return;

    const open = await this.prisma.machine_state_events.findFirst({
      where: { machine_id: id, ended_at: null },
      orderBy: { started_at: 'desc' },
      select: { id: true, machine_state_id: true, started_at: true },
    });

    if (open && open.machine_state_id === BigInt(machineStateId)) return; // already recording this state

    const legacyState = toLegacyState(stateName);

    await this.prisma.$transaction(async (tx) => {
      if (open) {
        const durationSeconds = Math.max(
          0,
          Math.round((now.getTime() - open.started_at.getTime()) / 1000),
        );
        await tx.machine_state_events.update({
          where: { id: open.id },
          data: { ended_at: now, duration_seconds: durationSeconds },
        });
      }
      await tx.machine_state_events.create({
        data: {
          machine_id: id,
          machine_state_id: machineStateId,
          state: legacyState as any,
          started_at: now,
        },
      });
    });

    socketService.emit('machine_status_runtime', {
      machine_id: machineId,
      machine_state_id: machineStateId,
      status: stateName.toUpperCase(),
      status_started_at: now.toISOString(),
      elapsed_seconds: 0,
    });
  }

  /**
   * Batched equivalent of `recordTransition` for mass simultaneous transitions
   * (e.g. shift start moving hundreds of machines to ACTIVE in one poll tick).
   * One `findMany` for all currently-open rows, one raw bulk close, one
   * `createMany` for all new rows — instead of N individual round trips.
   * All-or-nothing: on failure the caller should invalidate its cache for
   * every entry so the whole batch is retried next tick.
   */
  async recordTransitions(
    entries: Array<{ machineId: string; machineStateId: number; stateName: string }>,
    now: Date,
  ): Promise<void> {
    if (entries.length === 0) return;

    const parsed = entries
      .map((entry) => ({ ...entry, id: this.parseMachineId(entry.machineId) }))
      .filter(
        (
          entry,
        ): entry is { machineId: string; machineStateId: number; stateName: string; id: bigint } =>
          entry.id !== null,
      );
    if (parsed.length === 0) return;

    const openRows = await this.prisma.machine_state_events.findMany({
      where: { machine_id: { in: parsed.map((entry) => entry.id) }, ended_at: null },
      select: { id: true, machine_id: true, machine_state_id: true },
    });
    const openByMachine = new Map(openRows.map((row) => [row.machine_id.toString(), row]));

    const toClose: bigint[] = [];
    const toCreate: Array<{
      machine_id: bigint;
      machine_state_id: number;
      state: any;
      started_at: Date;
    }> = [];
    const toBroadcast: Array<{ machineId: string; machineStateId: number; stateName: string }> = [];

    for (const entry of parsed) {
      const open = openByMachine.get(entry.id.toString());
      if (open && open.machine_state_id === BigInt(entry.machineStateId)) continue; // already recording this state

      if (open) toClose.push(open.id);
      toCreate.push({
        machine_id: entry.id,
        machine_state_id: entry.machineStateId,
        state: toLegacyState(entry.stateName),
        started_at: now,
      });
      toBroadcast.push({
        machineId: entry.machineId,
        machineStateId: entry.machineStateId,
        stateName: entry.stateName,
      });
    }

    if (toCreate.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      if (toClose.length > 0) {
        // ROUND(...MICROSECOND.../1e6), not TIMESTAMPDIFF(SECOND, ...) — the
        // latter truncates instead of rounding, which would silently disagree
        // with recordTransition's Math.round and undercount duration_seconds
        // by up to 1s on every batched close.
        await tx.$executeRaw`
          UPDATE machine_state_events
          SET ended_at = ${now}, duration_seconds = GREATEST(0, ROUND(TIMESTAMPDIFF(MICROSECOND, started_at, ${now}) / 1000000))
          WHERE id IN (${Prisma.join(toClose)})
        `;
      }
      await tx.machine_state_events.createMany({ data: toCreate });
    });

    for (const entry of toBroadcast) {
      socketService.emit('machine_status_runtime', {
        machine_id: entry.machineId,
        machine_state_id: entry.machineStateId,
        status: entry.stateName.toUpperCase(),
        status_started_at: now.toISOString(),
        elapsed_seconds: 0,
      });
    }
  }

  /**
   * Auto-clear a manual-maintenance override: the machine's real (debounced)
   * status has confirmed ACTIVE while it was under an override. The Redis
   * override is lifted immediately either way — the board shows Active right
   * away, same as manual End does, matching physical reality in real time.
   * What happens to the schedule row depends on that row's `buffer_enabled`:
   *   - `true` (default): the row stays open — a `pending_confirm_until`
   *     verification window (that row's own `buffer_minutes`, chosen at
   *     "Activate now" time; `defaultVerificationBufferMs` only for rows
   *     activated before that column existed) starts instead of closing the
   *     row now. `ChannelMappingService`'s poll-tick check
   *     (`loadPendingConfirmations` + the pending-confirm branch in
   *     `applyMaintenanceOverride`) decides from there whether the row
   *     re-opens for Maintenance (board forced back, same row, if it drops
   *     out of Active before the deadline) or finalizes the close (deadline
   *     reached, still genuinely Active — the window itself doesn't count
   *     toward Maintenance duration).
   *   - `false`: pre-buffer behavior — close the row now, `ended_by='auto'`.
   * Called by `ChannelMappingService`'s override gate; legacy mode has no
   * auto-clear branch (manual End only, via the Laravel endpoint). Idempotent.
   */
  async clearMaintenanceOverride(machineId: string, now: Date): Promise<void> {
    const id = this.parseMachineId(machineId);
    if (id === null) return;

    await this.maintenanceOverride.clear(machineId);

    const open = await this.prisma.$queryRaw<
      Array<{
        id: bigint;
        buffer_enabled: number | boolean;
        buffer_minutes: number | null;
      }>
    >`
      SELECT id, buffer_enabled, buffer_minutes FROM machine_maintenance_schedules
      WHERE machine_id = ${id} AND ended_at IS NULL AND activated_at IS NOT NULL
      LIMIT 1
    `;
    const row = open[0];
    if (!row) return;

    if (row.buffer_enabled) {
      const bufferMs =
        row.buffer_minutes != null
          ? row.buffer_minutes * 60 * 1000
          : this.defaultVerificationBufferMs;
      const pendingConfirmUntil = new Date(now.getTime() + bufferMs);
      await this.prisma.$executeRaw`
        UPDATE machine_maintenance_schedules
        SET pending_confirm_until = ${pendingConfirmUntil}
        WHERE id = ${row.id}
      `;
      this.logger.log(
        `Maintenance verification window started: machine=${machineId} schedule=${row.id} board now showing Active; session finalizes at ${pendingConfirmUntil.toISOString()} unless it faults again first`,
      );
      return;
    }

    // Raw UPDATE (not updateMany) so duration_seconds can be computed from
    // activated_at in the same statement — ROUND(...MICROSECOND.../1e6), not
    // TIMESTAMPDIFF(SECOND, ...), to match recordTransition's Math.round
    // instead of truncating.
    await this.prisma.$executeRaw`
      UPDATE machine_maintenance_schedules
      SET ended_at = ${now}, ended_by = 'auto', duration_seconds = GREATEST(0, ROUND(TIMESTAMPDIFF(MICROSECOND, activated_at, ${now}) / 1000000))
      WHERE id = ${row.id}
    `;
  }

  /**
   * All open schedule rows currently inside their post-maintenance
   * verification window — loaded once per poll tick (not once per machine,
   * same idiom as `ChannelMappingService.resolveStatusRoles`) so
   * `ChannelMappingService`'s pending-confirm check can look each polled
   * machine up in O(1). The `pending_confirm_until` index keeps this cheap
   * regardless of table size — the result set is bounded by how many
   * machines are mid-window right now, not by total row count.
   */
  async loadPendingConfirmations(): Promise<Map<string, PendingConfirmation>> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        machine_id: bigint;
        schedule_id: bigint;
        pending_confirm_until: Date;
        buffer_minutes: number | null;
      }>
    >`
      SELECT machine_id, id AS schedule_id, pending_confirm_until, buffer_minutes
      FROM machine_maintenance_schedules
      WHERE ended_at IS NULL AND pending_confirm_until IS NOT NULL
    `;

    const out = new Map<string, PendingConfirmation>();
    for (const row of rows) {
      out.set(row.machine_id.toString(), {
        scheduleId: row.schedule_id,
        pendingConfirmUntil: row.pending_confirm_until,
        bufferMs:
          row.buffer_minutes != null
            ? row.buffer_minutes * 60 * 1000
            : this.defaultVerificationBufferMs,
      });
    }

    return out;
  }

  /**
   * Re-open a schedule row still inside its verification window: the machine
   * dropped out of ACTIVE (fault / idle / maintenance re-triggered) before
   * `pending_confirm_until`. Re-arms the SAME row (no duplicate row) —
   * re-adds the Redis override so subsequent ticks force MAINTENANCE again
   * through the normal override gate (not whatever raw status the channel
   * reads), and clears `pending_confirm_until` so the row reads as a normal
   * open session again. `activated_at` never moved, so the elapsed window
   * time counts toward this row's eventual Maintenance `duration_seconds`
   * once it is finally closed.
   */
  async reopenMaintenanceSession(machineId: string, scheduleId: bigint): Promise<void> {
    await this.maintenanceOverride.activate(machineId);
    await this.prisma.$executeRaw`
      UPDATE machine_maintenance_schedules
      SET pending_confirm_until = NULL
      WHERE id = ${scheduleId} AND ended_at IS NULL
    `;
    this.logger.log(
      `Maintenance verification window broken: machine=${machineId} dropped out of Active before the deadline — board forced back to Maintenance, re-opened schedule=${scheduleId} (no new row)`,
    );
  }

  /**
   * Finalize a schedule row whose verification window elapsed with the
   * machine still genuinely Active. `ended_at`/`duration_seconds` are
   * anchored to when the override was ORIGINALLY cleared
   * (`pendingConfirmUntil - bufferMs`, that row's own window length), not to
   * now — that window is genuinely Active time (the board already showed
   * Active throughout it) and must not be counted as Maintenance duration.
   */
  async finalizePendingConfirmation(
    scheduleId: bigint,
    pendingConfirmUntil: Date,
    bufferMs: number,
  ): Promise<void> {
    const clearedAt = new Date(pendingConfirmUntil.getTime() - bufferMs);
    await this.prisma.$executeRaw`
      UPDATE machine_maintenance_schedules
      SET ended_at = ${clearedAt}, ended_by = 'auto', pending_confirm_until = NULL,
          duration_seconds = GREATEST(0, ROUND(TIMESTAMPDIFF(MICROSECOND, activated_at, ${clearedAt}) / 1000000))
      WHERE id = ${scheduleId} AND ended_at IS NULL
    `;
    this.logger.log(
      `Maintenance verification window confirmed: schedule=${scheduleId} finalized, ended_at=${clearedAt.toISOString()} (window excluded from Maintenance duration)`,
    );
  }

  private parseMachineId(machineId: string): bigint | null {
    try {
      const id = BigInt(machineId);
      return id > 0n ? id : null;
    } catch {
      return null;
    }
  }
}
