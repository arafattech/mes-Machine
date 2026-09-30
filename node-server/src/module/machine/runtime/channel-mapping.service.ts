import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import axios from 'axios';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import jsmodbus = require('jsmodbus');
import { MachineService } from '@module/machine/machine.service';
import { MachineConfigService } from './machine-config.service';
import {
  ChannelReadFrom,
  ChannelRuntimeConfig,
  ChannelStatusEntry,
} from './machine-runtime.types';
import {
  buildChannelCounters,
  buildChannelLookup,
  ChannelAcquisition,
  ChannelLookup,
  decodeModbusCounters,
} from './channel-lookup.util';
import { MqttChannelSource } from './mqtt-channel-source';
import {
  MachineStateTrackerService,
  PendingConfirmation,
} from './machine-state-tracker.service';
import { MaintenanceOverrideService } from './maintenance-override.service';
import { MachineStateMeta } from './machine-runtime.types';

/**
 * Fallback display text only — used when a machine has no configured channels
 * reading HIGH AND no `machine_has_states.is_default` row, so there's no real
 * `machine_states` row to resolve a name from. Nothing is persisted to
 * `machine_state_events` in that case (see `pollConfigs`) — this never reaches
 * the DB as a fake state id.
 */
const DEFAULT_STATUS = 'INACTIVE';

// machineId -> acquisition (null = offline/unreachable this tick)
type LookupByMachine = Map<string, ChannelAcquisition | null>;

type PlcGroup = {
  url: string;
  configs: ChannelRuntimeConfig[];
  // Fastest configured request timeout among this PLC's machines; null = env.
  timeoutMs: number | null;
};

type ModbusGroup = {
  ip: string;
  configs: ChannelRuntimeConfig[];
  timeoutMs: number | null;
};

/**
 * Channel-based machine status poller.
 *
 * Active only when `CHANNEL_MAPPING_ENABLED!=='false'` (per-machine workers
 * are then disabled in MachineRuntimeService). Machines are bucketed into
 * cadence tiers (`resolveTierMs`) and each tier runs its own independent
 * self-scheduling loop (`tierTick`/`pollTier`) — a fast-configured machine
 * only speeds up its own tier, not the whole fleet. A fixed-cadence watcher
 * (`watchTiers`) starts/rediscovers tier loops as machines move between tiers.
 * Each tier tick:
 *   1. load machine configs (Redis-cached, see `MachineConfigService`);
 *   2. partition by `channel_read_from` (API / MODBUS / MQTT) and acquire
 *      each machine's channel `inputs` via the transport it's configured for;
 *   3. per machine, derive a candidate status and debounce it
 *      (`debounceStatus`) before treating it as real;
 *   4. broadcast the status over the existing Socket.IO gateway and persist
 *      confirmed transitions in a single batched write (see
 *      `MachineStateTrackerService.recordTransitions`).
 *
 * API and MODBUS are deduped per PLC IP/URL within a tier, and a PLC that
 * fails repeatedly is quarantined (`recordPlcResult`/`isPlcQuarantined`) so
 * dead hardware doesn't burn a full timeout wait on every tick. MQTT is
 * push-based: `MqttChannelSource` maintains a live cache from a persistent
 * subscription, and this service just reads the latest cached value.
 */
@Injectable()
export class ChannelMappingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelMappingService.name);

  private readonly enabled = process.env.CHANNEL_MAPPING_ENABLED !== 'false';
  // Fallbacks used when a machine has no DB-configured cadence / timeout.
  private readonly envIntervalMs = Number(
    process.env.CHANNEL_MAPPING_INTERVAL_MS ??
      process.env.MACHINE_PULL_DURATION ??
      2000,
  );
  private readonly envTimeoutMs = Number(
    process.env.CHANNEL_PLC_TIMEOUT_MS ?? 3000,
  );
  // Path appended to `http://<ip_plc>` when a machine has no explicit
  // `live_status_api`. The PLC must return JSON of shape `{ ip, inputs[] }`.
  private readonly statusPath = process.env.CHANNEL_PLC_STATUS_PATH ?? '/api/status';
  private readonly modbusPort = Number(process.env.CHANNEL_MODBUS_PORT ?? 502);
  // Success-path poll logging is high-volume at scale (every PLC, every tick) —
  // keep it off in production; failures always log regardless of this flag.
  private readonly verbosePollLogging = process.env.CHANNEL_POLL_DEBUG_LOG === 'true';
  // Off by default: reading counts costs a second Modbus round trip per PLC
  // per tick (FC4, on top of the existing FC2 discrete-input read) and most
  // fleets don't have any channel in Counter mode. API/MQTT already receive
  // counts for free in the same response/message, but still honor this flag
  // for a consistent contract across all three transports.
  private readonly readCountsEnabled = process.env.CHANNEL_READ_COUNTS === 'true';

  // A candidate status must hold for this long (wall-clock, not tick count —
  // tiers run at different cadences, so a tick-based counter would mean a
  // different real debounce window per tier) before it's treated as real.
  // Filters contact-bounce/electrical-noise flicker so it doesn't pollute
  // uptime/OEE data or spam writes.
  private readonly statusDebounceMs = Number(
    process.env.CHANNEL_STATUS_DEBOUNCE_MS ?? 1000,
  );

  // Cadence tiers (ms), ascending. Each machine is bucketed into the smallest
  // tier >= its configured cadence and polled by that tier's own independent
  // loop — so one fast-configured machine no longer forces the entire fleet
  // to re-poll at its rate.
  private readonly tierBucketsMs = (process.env.CHANNEL_CADENCE_TIERS_MS ?? '250,500,1000,2000,5000')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  // How often the tier watcher re-checks which tiers currently have machines
  // and spins up loops for newly-populated ones. Independent of any machine's
  // own cadence — deliberately not one of the fast tiers.
  private readonly tierWatchMs = Number(process.env.CHANNEL_TIER_WATCH_MS ?? 5000);

  // A PLC quarantined after too many consecutive failures is skipped entirely
  // (no connect attempt, no timeout wait) until its quarantine window elapses.
  private readonly plcMaxConsecutiveFailures = Number(
    process.env.CHANNEL_PLC_MAX_FAILURES ?? 3,
  );
  private readonly plcQuarantineMs = Number(
    process.env.CHANNEL_PLC_QUARANTINE_MS ?? 30000,
  );

  private watcherTimer?: NodeJS.Timeout;
  private stopped = false;
  // One entry per currently-running tier loop, keyed by tier bucket (ms).
  private readonly tiers = new Map<number, { timer?: NodeJS.Timeout; stopped: boolean }>();
  // Fast-path cache of the last persisted state per machine (machine_id →
  // machine_states.id, or null when nothing resolves). Skips a DB round-trip
  // while a machine's state is steady.
  private readonly lastState = new Map<string, number | null>();
  // Debounce bookkeeping per machine: last confirmed state id + in-flight
  // candidate + the epoch ms the candidate was first observed.
  private readonly statusDebounce = new Map<
    string,
    { confirmed: number | null; candidate: number | null; candidateSince: number }
  >();
  // PLC connectivity health per PLC key (ip/url) — consecutive failure count
  // and, once quarantined, the epoch ms until the next retry is allowed.
  private readonly plcHealth = new Map<
    string,
    { consecutiveFailures: number; quarantinedUntil: number | null }
  >();
  // Epoch ms of the last successful API/MODBUS read per PLC key (ip) — for
  // frontend "last seen" display, distinct from plcHealth's failure bookkeeping.
  private readonly lastSuccessAt = new Map<string, number>();
  // PLC IPs currently flagged for a mixed API/MODBUS read_from (Known issue #9)
  // — tracked so the warning logs once per newly-conflicting IP, not every tick.
  private readonly conflictedPlcIps = new Set<string>();
  // Persistent Modbus TCP connections, one per PLC IP, reused across ticks —
  // connect-once/read-on-tick instead of connect-on-tick. Evicted on error/
  // close/read-failure so the next read transparently reconnects.
  private readonly modbusConnections = new Map<string, { socket: net.Socket; client: any }>();

  // Reused across every API-transport poll tick — without keep-alive, each
  // tick pays a fresh TCP handshake per PLC, which is the single biggest
  // fixed per-request cost once the fleet is in the thousands.
  private readonly httpAgent = new http.Agent({ keepAlive: true });
  private readonly httpsAgent = new https.Agent({ keepAlive: true });

  constructor(
    private readonly machineConfigService: MachineConfigService,
    private readonly machineGateway: MachineService,
    private readonly mqtt: MqttChannelSource,
    private readonly machineStateTracker: MachineStateTrackerService,
    private readonly maintenanceOverride: MaintenanceOverrideService,
  ) {}

  onModuleInit() {
    if (!this.enabled) return;

    this.logger.log(
      `Channel mapping poller started (tiers=${this.tierBucketsMs.join(',')}ms, fallback=${this.envIntervalMs}ms)`,
    );
    void this.watchTiers();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.watcherTimer) clearTimeout(this.watcherTimer);
    for (const tier of this.tiers.values()) {
      tier.stopped = true;
      if (tier.timer) clearTimeout(tier.timer);
    }
    for (const conn of this.modbusConnections.values()) {
      conn.socket.removeAllListeners();
      conn.socket.destroy();
    }
    this.modbusConnections.clear();
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }

  /**
   * API/MODBUS machines sharing one PLC IP share one HTTP fetch / one
   * persistent TCP connection (see `groupByPlc`/`groupByModbusIp`) — they
   * must always land in the same tier, or two tier loops would poll the same
   * connection concurrently. So tiering uses the *fastest* configured cadence
   * across all machines on that IP, not each machine's cadence in isolation.
   * MQTT machines have no such shared connection and are tiered individually.
   */
  private buildIpCadenceMs(configs: ChannelRuntimeConfig[]): Map<string, number> {
    const ipCadenceMs = new Map<string, number>();
    for (const config of configs) {
      if (config.channel_read_from === 'MQTT') continue;
      const ip = config.ip?.trim();
      if (!ip) continue;

      const cadence = config.poll_interval_ms ?? this.envIntervalMs;
      const existing = ipCadenceMs.get(ip);
      if (existing === undefined || cadence < existing) ipCadenceMs.set(ip, cadence);
    }
    return ipCadenceMs;
  }

  /**
   * Bucket a machine's effective cadence into the smallest tier bucket that
   * can still satisfy it. Falls back to the slowest bucket if the cadence
   * exceeds every configured tier.
   *
   * MQTT is push-based — `poll_interval_ms` represents a polling budget that
   * doesn't apply (acquisition is a free cache read, not a network request),
   * so an MQTT machine always gets the fastest tier regardless of its
   * configured cadence. Without this, a `server_call_sec` set for some other
   * transport's load budget also throttles how often this service *notices*
   * a fresh cached MQTT reading and re-checks the status debounce — up to a
   * full extra tier cycle of pure detection lag on top of the debounce
   * window itself.
   */
  private resolveTierMs(config: ChannelRuntimeConfig, ipCadenceMs: Map<string, number>): number {
    if (config.channel_read_from === 'MQTT') {
      return this.tierBucketsMs[0] ?? this.envIntervalMs;
    }
    const ip = config.ip?.trim();
    const cadence =
      (ip ? ipCadenceMs.get(ip) : undefined) ?? config.poll_interval_ms ?? this.envIntervalMs;
    for (const bucket of this.tierBucketsMs) {
      if (cadence <= bucket) return bucket;
    }
    return this.tierBucketsMs[this.tierBucketsMs.length - 1] ?? this.envIntervalMs;
  }

  /**
   * Runs at a fixed cadence, independent of any machine's own poll interval.
   * Loads configs, figures out which cadence tiers currently have machines,
   * and starts a self-scheduling loop for any tier that doesn't have one yet.
   * A tier loop stops itself when its last machine leaves — this watcher is
   * what notices machines returning to a tier and restarts it.
   */
  private async watchTiers(): Promise<void> {
    if (this.stopped) return;

    try {
      const configs = await this.machineConfigService.loadChannelConfigs();
      const withChannels = configs.filter((c) => c.channels.length > 0);
      const ipCadenceMs = this.buildIpCadenceMs(withChannels);
      const activeTiers = new Set(withChannels.map((c) => this.resolveTierMs(c, ipCadenceMs)));

      for (const tierMs of activeTiers) {
        if (this.tiers.has(tierMs)) continue;
        const tierState = { stopped: false };
        this.tiers.set(tierMs, tierState);
        void this.tierTick(tierMs);
      }

      this.pruneStaleEntries(configs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tier watcher failed: ${message}`);
    }

    if (this.stopped) return;
    this.watcherTimer = setTimeout(() => void this.watchTiers(), this.tierWatchMs);
    this.watcherTimer.unref();
  }

  /**
   * Drop bookkeeping for machines/PLCs no longer in the active config set —
   * otherwise `lastState`, `statusDebounce`, `plcHealth`, and
   * `modbusConnections` grow for the process lifetime as machines are
   * decommissioned/renumbered over a system meant to run for months/years.
   */
  private pruneStaleEntries(configs: ChannelRuntimeConfig[]): void {
    const activeMachineIds = new Set(configs.map((c) => c.id));
    const activeIps = new Set(
      configs.map((c) => c.ip?.trim()).filter((ip): ip is string => !!ip),
    );

    // statusDebounce is written on every tick for every polled machine (the
    // superset); lastState only on an actual transition — union both so a
    // machine that hasn't transitioned yet still gets forgotten correctly.
    const knownMachineIds = new Set([...this.lastState.keys(), ...this.statusDebounce.keys()]);
    for (const id of knownMachineIds) {
      if (activeMachineIds.has(id)) continue;
      this.lastState.delete(id);
      this.statusDebounce.delete(id);
      this.machineGateway.forgetMachine(id);
    }
    for (const ip of this.plcHealth.keys()) {
      if (!activeIps.has(ip)) this.plcHealth.delete(ip);
    }
    for (const [ip, conn] of this.modbusConnections.entries()) {
      if (!activeIps.has(ip)) this.evictModbusConnection(ip, conn.socket);
    }
  }

  /**
   * Self-scheduling loop for one cadence tier. Scheduling only after
   * completion means no tick can overlap the previous one for this tier, and
   * cadence edits take effect without restart.
   */
  private async tierTick(tierMs: number): Promise<void> {
    const tier = this.tiers.get(tierMs);
    if (!tier || tier.stopped || this.stopped) return;

    const nextCadence = await this.pollTier(tierMs);

    const stillRunning = this.tiers.get(tierMs);
    if (!stillRunning || stillRunning.stopped || this.stopped) return;
    stillRunning.timer = setTimeout(() => void this.tierTick(tierMs), nextCadence);
    stillRunning.timer.unref();
  }

  /** Poll only the machines currently bucketed into this tier. */
  private async pollTier(tierMs: number): Promise<number> {
    try {
      const configs = await this.machineConfigService.loadChannelConfigs();
      const withChannels = configs.filter((c) => c.channels.length > 0);
      const ipCadenceMs = this.buildIpCadenceMs(withChannels);
      const tierConfigs = withChannels.filter(
        (c) => this.resolveTierMs(c, ipCadenceMs) === tierMs,
      );

      if (tierConfigs.length === 0) {
        // No machines left in this tier — stop; watchTiers restarts it if any return.
        this.tiers.delete(tierMs);
        return tierMs;
      }

      await this.pollConfigs(tierConfigs);
      return this.resolveCadence(tierConfigs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Channel poll failed (tier=${tierMs}ms): ${message}`);
      return tierMs;
    }
  }

  /** Acquire, derive, broadcast, and persist transitions for one set of machine configs. */
  private async pollConfigs(withChannels: ChannelRuntimeConfig[]): Promise<void> {
    this.warnOnReadFromConflicts(withChannels);

    const apiConfigs = withChannels.filter((c) => c.channel_read_from === 'API');
    const modbusConfigs = withChannels.filter((c) => c.channel_read_from === 'MODBUS');
    const mqttConfigs = withChannels.filter((c) => c.channel_read_from === 'MQTT');

    const [apiLookups, modbusLookups, statesById, pendingConfirmations] = await Promise.all([
      this.acquireApi(apiConfigs),
      this.acquireModbus(modbusConfigs),
      this.machineConfigService.loadMachineStatesMap(),
      this.machineStateTracker.loadPendingConfirmations(),
    ]);
    const mqttLookups = this.acquireMqtt(mqttConfigs);

    const lookups: LookupByMachine = new Map([
      ...apiLookups,
      ...modbusLookups,
      ...mqttLookups,
    ]);

    // Resolved once per tick, not once per machine — statesById is identical for every
    // machine in this tick, so deriving active/idle/fault/inactive role ids per-machine
    // was a repeated linear scan of the same tiny map.
    const roles = this.resolveStatusRoles(statesById);

    const changed: Array<{ machineId: string; machineStateId: number; stateName: string }> = [];
    // Widget-facing correction for a broken verification window (re-triggered
    // before the deadline) — populated by applyPendingConfirmationBuffer,
    // flushed only after persistTransitions so the corresponding
    // machine_status_runtime MAINTENANCE transition reaches the frontend
    // first (Socket.IO preserves per-connection emit order) and the
    // MachineDurationService correction lands on top of it, not before it.
    const recounts: Array<{
      machineId: string;
      fromStateId: number;
      toStateId: number;
      since: Date;
      until: Date;
    }> = [];

    for (const config of withChannels) {
      const acquisition = lookups.get(config.id) ?? null;
      this.machineGateway.broadcastPlcStatus(config.id, acquisition !== null);
      const { stateId: rawStateId, channel } = this.deriveStatus(
        config.channels,
        acquisition?.lookup ?? null,
        statesById,
        config.default_machine_state_id,
        roles,
      );
      const debouncedId = this.debounceStatus(config.id, rawStateId);
      // Manual-maintenance override gate — runs on the debounced status so it
      // can't fight contact-bounce flicker. Overridden + genuinely ACTIVE →
      // auto-clear and let the real status through immediately; overridden +
      // anything else → force MAINTENANCE.
      let stateId = await this.applyMaintenanceOverride(config.id, debouncedId, roles);

      // Post-maintenance verification window — the override is already
      // cleared for this machine (real status flows through above, board
      // shows Active), but its schedule row is still open pending either a
      // drop-out (re-open, force Maintenance back) or finalize.
      const pending = pendingConfirmations.get(config.id);
      if (pending) {
        stateId = await this.applyPendingConfirmationBuffer(
          config.id,
          debouncedId,
          roles,
          pending,
          recounts,
        );
      }
      const stateName = stateId !== null ? (statesById.get(stateId)?.name ?? DEFAULT_STATUS) : DEFAULT_STATUS;
      const lastSeenAt =
        config.channel_read_from === 'MQTT'
          ? this.mqtt.getLastReceivedAt(config.ip, config.id_iot)
          : (config.ip ? this.lastSuccessAt.get(config.ip) ?? null : null);

      this.machineGateway.broadcastData(config.id, {
        MNR: config.id,
        STATUS: stateName.toUpperCase(),
        channel,
        source: 'channel',
        inputs: acquisition?.inputs ?? null,
        counts: acquisition?.counts ?? null,
        lastSeenAt,
      });

      // Persist only on a confirmed (debounced) transition; broadcast stays every tick.
      // stateId is only null when neither a per-machine default nor a canonical
      // "Inactive" state (`roles.inactiveId`) is configured at all — e.g. a fresh
      // install with machine_states not yet seeded. In that edge case there's no
      // real machine_states row to persist, so it's skipped rather than faked.
      if (this.lastState.get(config.id) !== stateId) {
        this.lastState.set(config.id, stateId);
        if (stateId !== null) {
          changed.push({ machineId: config.id, machineStateId: stateId, stateName });
        }
      }
    }

    if (changed.length) await this.persistTransitions(changed);

    for (const r of recounts) {
      this.machineStateTracker.emitMaintenanceRecount(
        r.machineId,
        r.fromStateId,
        r.toStateId,
        r.since,
        r.until,
      );
    }
  }

  /**
   * Poll at the fastest configured cadence within this set; env fallback
   * when none set. MQTT configs are excluded — their `poll_interval_ms` is a
   * transport-load budget that doesn't apply to a push-based cache read (see
   * `resolveTierMs`), so it must never slow down this tier's own re-check
   * loop. An MQTT-only tier falls back to the fastest tier bucket, which is
   * exactly where `resolveTierMs` always places MQTT machines.
   */
  private resolveCadence(configs: ChannelRuntimeConfig[]): number {
    let min: number | null = null;
    for (const config of configs) {
      if (config.channel_read_from === 'MQTT') continue;
      const ms = config.poll_interval_ms;
      if (ms != null && (min === null || ms < min)) min = ms;
    }
    return min ?? this.tierBucketsMs[0] ?? this.envIntervalMs;
  }

  /**
   * Require a candidate status to hold for `statusDebounceMs` wall-clock time
   * before treating it as real — independent of which cadence tier the
   * machine is currently in, so the debounce window is the same real delay
   * everywhere. A brand-new machine (no prior confirmed status) is trusted
   * immediately — otherwise every newly-seen machine would sit at
   * DEFAULT_STATUS for the debounce window even if genuinely running.
   */
  private debounceStatus(machineId: string, rawStateId: number | null): number | null {
    const now = Date.now();
    const entry = this.statusDebounce.get(machineId);
    if (!entry) {
      this.statusDebounce.set(machineId, {
        confirmed: rawStateId,
        candidate: rawStateId,
        candidateSince: now,
      });
      return rawStateId;
    }

    if (rawStateId === entry.confirmed) {
      entry.candidate = rawStateId;
      entry.candidateSince = now;
      return entry.confirmed;
    }

    if (rawStateId !== entry.candidate) {
      entry.candidate = rawStateId;
      entry.candidateSince = now;
    }

    if (now - entry.candidateSince >= this.statusDebounceMs) {
      entry.confirmed = rawStateId;
    }

    return entry.confirmed;
  }

  /**
   * Manual-maintenance override gate. When the machine is in the Redis override
   * set (`machine:maintenance_overrides`), force MAINTENANCE regardless of the
   * debounced real status — unless the debounced status is a confirmed ACTIVE,
   * in which case the machine is genuinely running again: auto-clear the
   * override (clears the Redis set; the schedule row either closes right away
   * or enters its verification window, see `clearMaintenanceOverride`) and let
   * the real ACTIVE status through immediately. No-op for machines not
   * overridden.
   */
  private async applyMaintenanceOverride(
    machineId: string,
    debouncedStateId: number | null,
    roles: StatusRoles,
  ): Promise<number | null> {
    if (!(await this.maintenanceOverride.isOverridden(machineId))) {
      return debouncedStateId;
    }

    if (
      debouncedStateId !== null &&
      roles.activeId !== null &&
      debouncedStateId === roles.activeId
    ) {
      await this.machineStateTracker.clearMaintenanceOverride(machineId, new Date());
      return debouncedStateId;
    }

    // Overridden and not genuinely running — force MAINTENANCE. Fall back to
    // the debounced id if the admin hasn't defined a Maintenance state.
    return roles.maintenanceId ?? debouncedStateId;
  }

  /**
   * Post-maintenance verification window. Only called for a machine whose
   * open schedule row currently has a non-null `pending_confirm_until` — the
   * Redis override was already cleared for it (board is showing the real
   * Active status), so `debouncedStateId` is the machine's real, unforced
   * status this tick:
   *   - no longer confirmed ACTIVE (fault / idle / maintenance re-triggered)
   *     before the deadline → re-open the SAME row and force MAINTENANCE
   *     back onto the board immediately, same tick — not whatever raw status
   *     the channel currently reads.
   *   - still confirmed ACTIVE past the deadline → finalize the close (the
   *     window itself is not counted as Maintenance time).
   *   - still confirmed ACTIVE, deadline not reached yet → no-op, real
   *     ACTIVE keeps flowing through as-is (board already shows it).
   *
   * A broken window also queues a `recounts` entry: the "STATE DURATIONS
   * (TODAY)" widget (`machine-duration.service.ts`, fleet-wide, keyed purely
   * off `machine_state_events`/`machine_status_runtime`) has no notion of a
   * maintenance session — it faithfully recorded the window as real Active
   * time, same as the board did. Since a false recovery means that whole
   * span should count as Maintenance after all (same duration attribution as
   * `machine_maintenance_schedules.duration_seconds`), the caller emits a
   * correction (`emitMaintenanceRecount`) after this tick's normal
   * MAINTENANCE transition lands, moving that span from Active to
   * Maintenance in the widget's totals. A window that finalizes instead
   * needs no such correction — it genuinely was Active, which is exactly
   * what both the board and the widget already show.
   */
  private async applyPendingConfirmationBuffer(
    machineId: string,
    debouncedStateId: number | null,
    roles: StatusRoles,
    pending: PendingConfirmation,
    recounts: Array<{
      machineId: string;
      fromStateId: number;
      toStateId: number;
      since: Date;
      until: Date;
    }>,
  ): Promise<number | null> {
    const stillConfirmedActive =
      debouncedStateId !== null && roles.activeId !== null && debouncedStateId === roles.activeId;

    if (!stillConfirmedActive) {
      await this.machineStateTracker.reopenMaintenanceSession(machineId, pending.scheduleId);

      if (roles.activeId !== null && roles.maintenanceId !== null) {
        const since = new Date(pending.pendingConfirmUntil.getTime() - pending.bufferMs);
        recounts.push({
          machineId,
          fromStateId: roles.activeId,
          toStateId: roles.maintenanceId,
          since,
          until: new Date(),
        });
      }

      return roles.maintenanceId ?? debouncedStateId;
    }

    if (Date.now() >= pending.pendingConfirmUntil.getTime()) {
      await this.machineStateTracker.finalizePendingConfirmation(
        pending.scheduleId,
        pending.pendingConfirmUntil,
        pending.bufferMs,
      );
    }

    return debouncedStateId;
  }

  private isPlcQuarantined(plcKey: string): boolean {
    const health = this.plcHealth.get(plcKey);
    return !!health?.quarantinedUntil && Date.now() < health.quarantinedUntil;
  }

  /**
   * Track consecutive failures per PLC; quarantine once the threshold is hit
   * so a persistently-dead PLC stops burning a full connect+timeout wait on
   * every tick and competing with healthy PLCs for the same tick window.
   */
  private recordPlcResult(plcKey: string, success: boolean): void {
    const health = this.plcHealth.get(plcKey) ?? {
      consecutiveFailures: 0,
      quarantinedUntil: null,
    };

    if (success) {
      if (health.quarantinedUntil) {
        this.logger.log(`PLC ${plcKey} recovered — ending quarantine`);
      }
      health.consecutiveFailures = 0;
      health.quarantinedUntil = null;
      this.lastSuccessAt.set(plcKey, Date.now());
    } else {
      health.consecutiveFailures += 1;
      if (
        health.consecutiveFailures >= this.plcMaxConsecutiveFailures &&
        !health.quarantinedUntil
      ) {
        health.quarantinedUntil = Date.now() + this.plcQuarantineMs;
        this.logger.warn(
          `PLC ${plcKey} failed ${health.consecutiveFailures} consecutive polls — quarantining for ${this.plcQuarantineMs}ms`,
        );
      }
    }

    this.plcHealth.set(plcKey, health);
  }

  /**
   * Guard against Known issue #9: machines sharing one `ip_plc` must agree on
   * `read_from` (API vs MODBUS), or the poller hits that physical device with
   * both an HTTP request and a Modbus TCP read, concurrently, every tick —
   * observed to crash an ESP32-P4 in production. Detection only (config
   * hygiene is the actual fix, see CONTEXT.md §13 #9) — logs once per
   * newly-conflicting IP rather than every tick, same idiom as
   * `recordPlcResult`'s quarantine logging, and clears silently on
   * resolution. MQTT is excluded: it never sends a request to the device, so
   * it can't collide with an API/MODBUS read on the same IP. Same-IP
   * API/MODBUS machines are always tiered together (`buildIpCadenceMs`
   * ignores `channel_read_from`), so checking within one tier's config set
   * catches every real conflict.
   */
  private warnOnReadFromConflicts(configs: ChannelRuntimeConfig[]): void {
    const readFromsByIp = new Map<string, Set<ChannelReadFrom>>();
    for (const config of configs) {
      if (config.channel_read_from === 'MQTT') continue;
      const ip = config.ip?.trim();
      if (!ip) continue;

      const readFroms = readFromsByIp.get(ip) ?? new Set<ChannelReadFrom>();
      readFroms.add(config.channel_read_from);
      readFromsByIp.set(ip, readFroms);
    }

    const currentConflicts = new Set<string>();
    for (const [ip, readFroms] of readFromsByIp) {
      if (readFroms.size <= 1) continue;
      currentConflicts.add(ip);
      if (!this.conflictedPlcIps.has(ip)) {
        this.logger.warn(
          `PLC ${ip} has machines with conflicting read_from (${[...readFroms].join(', ')}) — concurrent API+MODBUS reads against the same device can crash it. Fix machine_has_configs.read_from so every machine on this ip_plc agrees.`,
        );
      }
    }

    for (const ip of this.conflictedPlcIps) {
      if (!currentConflicts.has(ip)) {
        this.logger.log(`PLC ${ip} read_from conflict resolved`);
      }
    }
    this.conflictedPlcIps.clear();
    for (const ip of currentConflicts) this.conflictedPlcIps.add(ip);
  }

  private async persistTransitions(
    changed: Array<{ machineId: string; machineStateId: number; stateName: string }>,
  ): Promise<void> {
    const now = new Date();
    try {
      await this.machineStateTracker.recordTransitions(changed, now);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to record ${changed.length} state transition(s): ${message}`,
      );
      // Drop every entry's cache so the whole batch is retried next tick.
      for (const c of changed) this.lastState.delete(c.machineId);
    }
  }

  // ---------------------------------------------------------------------
  // API transport
  // ---------------------------------------------------------------------

  private async acquireApi(configs: ChannelRuntimeConfig[]): Promise<LookupByMachine> {
    const out: LookupByMachine = new Map();
    const groups = this.groupByPlc(configs);

    const results = await Promise.all(
      [...groups.entries()].map(([ip, group]) =>
        this.fetchPlcTracked(ip, group.url, group.timeoutMs ?? this.envTimeoutMs),
      ),
    );

    let i = 0;
    for (const group of groups.values()) {
      const lookup = results[i++];
      for (const config of group.configs) out.set(config.id, lookup);
    }
    return out;
  }

  /** `fetchPlc`, but skipped entirely (no connect attempt) while quarantined. */
  private async fetchPlcTracked(
    plcKey: string,
    url: string,
    timeoutMs: number,
  ): Promise<ChannelAcquisition | null> {
    if (this.isPlcQuarantined(plcKey)) return null;
    const acquisition = await this.fetchPlc(url, timeoutMs);
    this.recordPlcResult(plcKey, acquisition !== null);
    return acquisition;
  }

  /**
   * Group machines by PLC IP so each PLC is fetched once. The group URL is
   * the machine's `live_status_api` when set, else `http://<ip><statusPath>`.
   */
  private groupByPlc(configs: ChannelRuntimeConfig[]): Map<string, PlcGroup> {
    const groups = new Map<string, PlcGroup>();

    for (const config of configs) {
      const ip = config.ip?.trim();
      if (!ip) continue;

      let group = groups.get(ip);
      if (!group) {
        group = { url: this.resolvePlcUrl(config), configs: [], timeoutMs: null };
        groups.set(ip, group);
      }
      group.configs.push(config);

      const timeout = config.request_timeout_ms;
      if (timeout != null) {
        group.timeoutMs =
          group.timeoutMs === null ? timeout : Math.min(group.timeoutMs, timeout);
      }
    }

    return groups;
  }

  private resolvePlcUrl(config: ChannelRuntimeConfig): string {
    const api = config.live_status_api?.trim();
    if (api && /^https?:\/\//i.test(api)) return api;
    return `http://${config.ip}${this.statusPath}`;
  }

  /** Fetch a PLC once and convert its `inputs`/`counts` arrays into a channel acquisition. */
  private async fetchPlc(
    url: string,
    timeoutMs: number,
  ): Promise<ChannelAcquisition | null> {
    try {
      const { data } = await axios.get(url, {
        timeout: timeoutMs,
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent,
      });
      const inputs = Array.isArray(data?.inputs) ? data.inputs : null;
      if (!inputs) {
        this.logger.warn(`PLC ${url} returned no inputs array`);
        return null;
      }
      let counts: number[] = new Array(10).fill(0);
      if (this.readCountsEnabled) {
        if (!Array.isArray(data?.counts)) {
          this.logger.warn(`PLC ${url} returned no counts array — defaulting to zeros`);
        }
        counts = buildChannelCounters(Array.isArray(data?.counts) ? data.counts : []);
      }
      if (this.verbosePollLogging) {
        this.logger.log(`API poll OK: ${url} inputs=${JSON.stringify(inputs)}`);
        if (this.readCountsEnabled) {
          this.logger.log(`API poll OK: ${url} counts=${JSON.stringify(counts)}`);
        }
      }
      return {
        lookup: buildChannelLookup(inputs),
        inputs: inputs.map(Boolean),
        counts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`API poll failed: ${url} unreachable: ${message}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // MODBUS transport
  // ---------------------------------------------------------------------

  private async acquireModbus(configs: ChannelRuntimeConfig[]): Promise<LookupByMachine> {
    const out: LookupByMachine = new Map();
    const groups = this.groupByModbusIp(configs);
    const ips = [...groups.keys()];

    const results = await Promise.all(
      ips.map((ip) =>
        this.readModbusInputsTracked(ip, groups.get(ip)!.timeoutMs ?? this.envTimeoutMs),
      ),
    );

    ips.forEach((ip, idx) => {
      const lookup = results[idx];
      for (const config of groups.get(ip)!.configs) out.set(config.id, lookup);
    });
    return out;
  }

  /** Group machines by PLC IP so each PLC's discrete inputs are read once. */
  private groupByModbusIp(configs: ChannelRuntimeConfig[]): Map<string, ModbusGroup> {
    const groups = new Map<string, ModbusGroup>();

    for (const config of configs) {
      const ip = config.ip?.trim();
      if (!ip) continue;

      let group = groups.get(ip);
      if (!group) {
        group = { ip, configs: [], timeoutMs: null };
        groups.set(ip, group);
      }
      group.configs.push(config);

      const timeout = config.request_timeout_ms;
      if (timeout != null) {
        group.timeoutMs =
          group.timeoutMs === null ? timeout : Math.min(group.timeoutMs, timeout);
      }
    }

    return groups;
  }

  /** `readModbusInputs`, but skipped entirely (no connect attempt) while quarantined. */
  private async readModbusInputsTracked(
    ip: string,
    timeoutMs: number,
  ): Promise<ChannelAcquisition | null> {
    if (this.isPlcQuarantined(ip)) return null;
    const acquisition = await this.readModbusInputs(ip, timeoutMs);
    this.recordPlcResult(ip, acquisition !== null);
    return acquisition;
  }

  /**
   * Read 10 discrete inputs (DI0..DI9, FC2) plus 20 input registers (10 x
   * 32-bit counters, FC4) over a persistent per-PLC connection — connect
   * once, read-on-tick thereafter, instead of connect/teardown every tick.
   * Reconnects transparently on the next call after any drop. The counter
   * read failing on its own (discrete-input read still OK) falls back to
   * zero counts rather than failing the whole poll — status derivation only
   * needs `inputs`, counts are additive.
   */
  private async readModbusInputs(ip: string, timeoutMs: number): Promise<ChannelAcquisition | null> {
    let conn = this.modbusConnections.get(ip);
    if (!conn) {
      const connected = await this.connectModbus(ip, timeoutMs);
      if (!connected) return null;
      conn = connected;
    }

    let values: number[];
    try {
      const resp: any = await conn.client.readDiscreteInputs(0, 10);
      values = Array.from(resp?.response?.body?.valuesAsArray ?? []).slice(0, 10) as number[];
      if (this.verbosePollLogging) {
        this.logger.log(`Modbus poll OK: ${ip} inputs=${JSON.stringify(values)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Modbus poll failed: ${ip} read failed: ${message}`);
      this.evictModbusConnection(ip, conn.socket);
      return null;
    }

    let counts: number[] = new Array(10).fill(0);
    if (this.readCountsEnabled) {
      try {
        const resp: any = await conn.client.readInputRegisters(0, 20);
        const registers = Array.from(resp?.response?.body?.valuesAsArray ?? []) as number[];
        counts = decodeModbusCounters(registers);
        if (this.verbosePollLogging) {
          this.logger.log(`Modbus poll OK: ${ip} counts=${JSON.stringify(counts)}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Modbus counter read failed: ${ip}: ${message} — defaulting to zeros`);
      }
    }

    return { lookup: buildChannelLookup(values), inputs: values.map(Boolean), counts };
  }

  /** Open (or replace) the persistent connection for a PLC IP. */
  private connectModbus(
    ip: string,
    timeoutMs: number,
  ): Promise<{ socket: net.Socket; client: any } | null> {
    const stale = this.modbusConnections.get(ip);
    if (stale) this.evictModbusConnection(ip, stale.socket);

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const client = new jsmodbus.client.TCP(socket, 0);
      let settled = false;

      const failConnect = (reason: string) => {
        this.logger.error(`Modbus poll failed: ${ip} ${reason}`);
        this.evictModbusConnection(ip, socket);
        if (!settled) {
          settled = true;
          resolve(null);
        }
      };

      // Guards the connect only: disabled once connected (below) so the idle
      // gap between polls never trips this and tears down a live socket.
      socket.setTimeout(timeoutMs);
      socket.on('timeout', () => failConnect(`connect/read timeout after ${timeoutMs}ms`));
      socket.on('error', (error) => failConnect(`error: ${error.message}`));
      socket.on('close', () => {
        if (!settled) return failConnect('connection closed before ready');
        this.evictModbusConnection(ip, socket); // dropped after being usable; next read reconnects
      });
      socket.once('connect', () => {
        if (settled) return;
        settled = true;
        socket.setTimeout(0);
        const conn = { socket, client };
        this.modbusConnections.set(ip, conn);
        resolve(conn);
      });

      socket.connect({ host: ip, port: this.modbusPort });
    });
  }

  /** Remove a PLC's persistent connection entry and tear down its socket, if it's still the current one. */
  private evictModbusConnection(ip: string, socket: net.Socket): void {
    const current = this.modbusConnections.get(ip);
    if (current?.socket === socket) this.modbusConnections.delete(ip);
    socket.removeAllListeners();
    socket.destroy();
  }

  // ---------------------------------------------------------------------
  // MQTT transport
  // ---------------------------------------------------------------------

  private acquireMqtt(configs: ChannelRuntimeConfig[]): LookupByMachine {
    const out: LookupByMachine = new Map();
    for (const config of configs) {
      out.set(config.id, this.mqtt.getLatestForMachine(config.ip, config.id_iot));
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // Status derivation (transport-agnostic)
  // ---------------------------------------------------------------------

  /**
   * Derive a machine's state from its configured channels — genuinely
   * arbitrary N states, not a fixed 2-3-channel truth table:
   *   1. Every configured channel reading HIGH is a *candidate*
   *      (`entry.machine_state_id`).
   *   2. A sensor-contradiction Fault candidate is computed in code (see
   *      `detectContradictionFault`) — restores the old hardcoded
   *      Active-HIGH+Idle-LOW → Fault rule, derived from the Active/Idle
   *      channels' own readings rather than a dedicated Fault input.
   *   3. The candidate with the highest `machine_states.priority` wins —
   *      replaces the old fixed precedence (Maintenance checked first, then
   *      Active/Idle, Fault as the active+idle sensor contradiction).
   *   4. If nothing reads HIGH and no contradiction, fall back to this
   *      machine's designated default (`machine_has_states.is_default`,
   *      passed in as `defaultStateId`) — replaces the old hardcoded
   *      `else -> INACTIVE`.
   *
   * PLC offline (`lookup` null) → always resolves to the canonical "Inactive"
   * state (`roles.inactiveId`), never the per-machine default. `defaultStateId`
   * (`machine_has_states.is_default`) means "this machine's expected state when
   * it's connected and reporting but no channel reads HIGH" (e.g. a machine
   * wired without an Idle channel that should still show Idle at rest) — it is
   * not a stand-in for "PLC stopped responding." A disconnected PLC is a
   * distinct, unambiguous fact regardless of what a given machine's configured
   * default is, so it must never be reported as Idle/Active/etc. Falls back to
   * `defaultStateId` only if no canonical Inactive state exists at all (e.g.
   * `machine_states` not yet seeded), and to `stateId: null` (unpersisted) only
   * if neither exists — see fallback comments below.
   */
  private deriveStatus(
    channels: ChannelStatusEntry[],
    lookup: ChannelLookup | null,
    statesById: Map<number, MachineStateMeta>,
    defaultStateId: number | null,
    roles: StatusRoles,
  ): { stateId: number | null; channel: number | null } {
    if (!lookup) {
      // Silent/disconnected machine — must still resolve to a real, persistable state
      // so `pollConfigs` pushes the transition and `machine_status_runtime` fires
      // (otherwise MachineDurationService's board/overview timers freeze and keep
      // counting the last known live state forever). Canonical Inactive always wins
      // here over the per-machine default — see doc comment above.
      if (roles.inactiveId !== null) return { stateId: roles.inactiveId, channel: null };
      if (defaultStateId !== null) return { stateId: defaultStateId, channel: null };
      return { stateId: null, channel: null };
    }

    let best: { stateId: number; priority: number; channel: number } | null = null;
    for (const entry of channels) {
      if (lookup[entry.channel_id] !== true) continue;
      const priority = statesById.get(entry.machine_state_id)?.priority ?? 0;
      if (!best || priority > best.priority) {
        best = { stateId: entry.machine_state_id, priority, channel: entry.channel_id };
      }
    }

    const faultCandidate = this.detectContradictionFault(channels, lookup, roles);
    if (faultCandidate && (!best || faultCandidate.priority > best.priority)) {
      best = faultCandidate;
    }

    if (best) return { stateId: best.stateId, channel: best.channel };
    if (defaultStateId !== null) return { stateId: defaultStateId, channel: null };

    // No per-machine default configured (`machine_has_states.is_default`) and the PLC
    // is online but nothing reads HIGH — fall back to the canonical "Inactive" state
    // so this still resolves to a real, persistable state rather than `null`.
    if (roles.inactiveId !== null) return { stateId: roles.inactiveId, channel: null };
    return { stateId: null, channel: null };
  }

  /**
   * Active/Idle/Fault/Inactive role ids, resolved by state *name* — once per tick
   * (`pollConfigs`), not once per machine. `statesById` is identical for every machine in a
   * given tick, so re-scanning it inside `deriveStatus`/`detectContradictionFault` per
   * machine was a repeated linear scan of the same ~5-10 row map; this hoists that single
   * scan out of the per-machine loop. Same "last match wins" semantics as the scans it
   * replaces (Map iteration order is insertion order from `loadMachineStatesMap`).
   */
  private resolveStatusRoles(statesById: Map<number, MachineStateMeta>): StatusRoles {
    let activeId: number | null = null;
    let idleId: number | null = null;
    let faultMeta: MachineStateMeta | null = null;
    let inactiveId: number | null = null;
    let maintenanceId: number | null = null;
    for (const meta of statesById.values()) {
      const name = meta.name?.toLowerCase();
      if (name === 'active') activeId = meta.id;
      else if (name === 'idle') idleId = meta.id;
      else if (name === 'fault') faultMeta = meta;
      else if (name === 'inactive') inactiveId = meta.id;
      else if (name === 'maintenance') maintenanceId = meta.id;
    }
    return { activeId, idleId, faultMeta, inactiveId, maintenanceId };
  }

  /**
   * Sensor-contradiction Fault, restored: an Active-tagged channel reading HIGH
   * while every Idle-tagged channel on this machine reads LOW is treated as a
   * Fault candidate at Fault's own configured priority — competing against
   * whatever channel-HIGH candidate `deriveStatus` already found (so e.g.
   * Maintenance still wins if its priority is higher, same precedence as the
   * old hardcoded truth table). Resolved by state *name* ("active"/"idle"/
   * "fault", case-insensitive), not a hardcoded channel index, so it works
   * regardless of which channel numbers a given machine wires them to — and
   * is a no-op for any machine that hasn't tagged all three of those states.
   */
  private detectContradictionFault(
    channels: ChannelStatusEntry[],
    lookup: ChannelLookup,
    roles: StatusRoles,
  ): { stateId: number; priority: number; channel: number } | null {
    const { activeId, idleId, faultMeta } = roles;
    if (activeId === null || idleId === null || !faultMeta) return null;

    const activeChannels = channels.filter((c) => c.machine_state_id === activeId);
    const idleChannels = channels.filter((c) => c.machine_state_id === idleId);
    if (!activeChannels.length || !idleChannels.length) return null;

    const activeHigh = activeChannels.some((c) => lookup[c.channel_id] === true);
    const idleLow = idleChannels.every((c) => lookup[c.channel_id] !== true);
    if (!activeHigh || !idleLow) return null;

    return { stateId: faultMeta.id, priority: faultMeta.priority, channel: activeChannels[0].channel_id };
  }
}

/** Active/Idle/Fault/Inactive/Maintenance `machine_states` role ids for one tick —
 * resolved once by `resolveStatusRoles`, reused across every machine in that
 * tick's `pollConfigs` call. */
type StatusRoles = {
  activeId: number | null;
  idleId: number | null;
  faultMeta: MachineStateMeta | null;
  inactiveId: number | null;
  maintenanceId: number | null;
};
