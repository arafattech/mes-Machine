import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import { Worker, WorkerOptions } from 'worker_threads';
import { PrismaService } from '@prisma/prisma.service';
import { MachineService } from '@module/machine/machine.service';
import { MachineConfigService } from './machine-config.service';
import {
  MachineRuntimeConfig,
  WorkerOutMessage,
} from './machine-runtime.types';
import { MachineStateTrackerService } from './machine-state-tracker.service';
import { MaintenanceOverrideService } from './maintenance-override.service';

type WorkerEntry = {
  worker: Worker;
  config: MachineRuntimeConfig;
  restartDelay: number;
  restartTimer?: NodeJS.Timeout;
};

@Injectable()
export class MachineRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MachineRuntimeService.name);
  private readonly workers = new Map<string, WorkerEntry>();
  private stopping = false;
  private watchTimer?: NodeJS.Timeout;

  private readonly watchMs = Number(
    process.env.MACHINE_WATCH_MS ?? process.env.WATCH_MS ?? 30000,
  );
  private readonly maxRestart = Number(
    process.env.MACHINE_MAX_RESTART ?? process.env.MAX_RESTART ?? 30000,
  );
  private readonly spawnStaggerMs = Number(
    process.env.MACHINE_SPAWN_STAGGER ?? 200,
  );
  // When channel mapping mode is on, machine status comes from the grouped
  // per-PLC poller (ChannelMappingService); the per-machine workers stay off
  // so each PLC is polled exactly once instead of once per machine.
  private readonly channelMappingEnabled =
    process.env.CHANNEL_MAPPING_ENABLED !== 'false';
  // Safety ceiling on simultaneously-running worker threads (each is its own
  // OS thread + event loop + Modbus socket) — a pool/queue instead of an
  // unconditional one-thread-per-machine spawn. Sized to the module's own
  // stated future scale, so real deployments never actually queue; it exists
  // to fail gracefully (not with a thread-spawn storm) on misconfiguration.
  private readonly maxConcurrentWorkers = Number(
    process.env.MACHINE_MAX_CONCURRENT_WORKERS ?? 1000,
  );
  private pendingWorkerConfigs: MachineRuntimeConfig[] = [];

  // Fast-path cache of the last derived state per machine (machine_id → state).
  // Mirrors ChannelMappingService's lastState pattern so a persisted transition
  // is only recorded when the derived status actually changes.
  // Keyed by machine_states.id (resolved from the 3 legacy name labels — see
  // `deriveLegacyState`/`resolveLegacyStateId`), not a hardcoded string union.
  private readonly lastState = new Map<string, number>();
  // Per-machine DB-write ordering: workers relay writes as fire-and-forget
  // messages, so without this two rapid writes for the same machine (e.g. two
  // shots detected before the first save round-trips) could race and lose an
  // update. Chains each machine's writes in send order; different machines
  // still run fully concurrently against the shared pool.
  private readonly pendingWrites = new Map<string, Promise<void>>();

  constructor(
    private readonly machineConfigService: MachineConfigService,
    private readonly machineGateway: MachineService,
    private readonly machineStateTracker: MachineStateTrackerService,
    private readonly maintenanceOverride: MaintenanceOverrideService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.stopAll('module_destroy');
  }

  private async start() {
    if (this.channelMappingEnabled) {
      this.logger.log(
        'CHANNEL_MAPPING_ENABLED=true - per-machine workers disabled; ChannelMappingService owns status polling.',
      );
      return;
    }

    const configs = await this.machineConfigService.loadConfigs();
    for (const config of configs) {
      this.enqueueWorker(config);
      await this.delay(this.spawnStaggerMs);
    }

    this.startConfigWatcher();
    this.logger.log(
      `Machine runtime started with ${configs.length} machine(s), ${this.workers.size} worker(s) running` +
        (this.pendingWorkerConfigs.length
          ? `, ${this.pendingWorkerConfigs.length} queued`
          : ''),
    );
  }

  /** Spawn immediately if under the concurrency cap, else queue for the next free slot. */
  private enqueueWorker(config: MachineRuntimeConfig) {
    if (this.workers.size >= this.maxConcurrentWorkers) {
      this.pendingWorkerConfigs.push(config);
      this.logger.warn(
        `Worker cap (${this.maxConcurrentWorkers}) reached - queuing machine ${config.id} (${this.pendingWorkerConfigs.length} queued)`,
      );
      return;
    }
    this.spawnWorker(config);
  }

  /** Called whenever a worker slot frees up, to promote the next queued machine. */
  private promoteQueuedWorker() {
    if (this.workers.size >= this.maxConcurrentWorkers) return;
    const next = this.pendingWorkerConfigs.shift();
    if (next) this.spawnWorker(next);
  }

  private spawnWorker(config: MachineRuntimeConfig) {
    const id = String(config.id);
    const worker = this.createWorker(config);

    const entry: WorkerEntry = {
      worker,
      config: { ...config },
      restartDelay: 1000,
    };
    this.workers.set(id, entry);

    worker.on('message', (msg: WorkerOutMessage) => {
      switch (msg.type) {
        case 'data':
          this.machineGateway.broadcastData(msg.machineId, msg.payload);
          // Keep log behavior aligned with demo_idea/index.js
          // eslint-disable-next-line no-console
          // console.log('DATA LOG');
          void this.trackLegacyState(msg.machineId, msg.payload);
          break;
        case 'dead':
          this.machineGateway.broadcastPlcStatus(msg.machineId, false, true);
          this.logger.error(`Worker dead for machine ${msg.machineId}`);
          break;
        case 'connection':
          this.machineGateway.broadcastPlcStatus(msg.machineId, msg.connected);
          worker.postMessage({ type: msg.connected ? 'resume' : 'pause' });
          break;
        case 'error':
          this.logger.error(
            `Worker error for machine ${msg.machineId}: ${msg.error}`,
          );
          break;
        case 'get_counter':
          void this.handleGetCounter(worker, msg.machineId, msg.requestId);
          break;
        case 'save_counter':
          this.serializeWrite(msg.machineId, () =>
            this.handleSaveCounter(msg.machineId, msg.shotNr, msg.lastCycleTime, msg.cycleTime),
          );
          break;
        case 'set_heating_start':
          this.serializeWrite(msg.machineId, () =>
            this.handleSetHeatingStart(msg.machineId, msg.timestamp),
          );
          break;
        case 'clear_heating_start':
          this.serializeWrite(msg.machineId, () => this.handleClearHeatingStart(msg.machineId));
          break;
        case 'record_production_shot':
          this.serializeWrite(msg.machineId, () =>
            this.handleRecordProductionShot(msg.machineId, msg.isGood),
          );
          break;
      }
    });

    worker.on('error', (error) => {
      this.logger.error(`Thread error [machine ${id}]: ${error.message}`);
    });

    worker.on('exit', (code) => {
      if (this.stopping) return;

      if (code === 0) {
        this.workers.delete(id);
        this.logger.log(`Worker exited cleanly [machine ${id}]`);
        this.promoteQueuedWorker();
        return;
      }

      const delay = entry.restartDelay;
      entry.restartTimer = setTimeout(() => {
        if (this.stopping) return;
        this.spawnWorker(config);
      }, delay);
      entry.restartDelay = Math.min(delay * 2, this.maxRestart);
      this.logger.warn(
        `Worker exited with code=${code} [machine ${id}] - restarting in ${delay}ms`,
      );
    });

    this.logger.log(
      `Worker spawned [machine ${id}] transport=${config.transport}`,
    );
  }

  private createWorker(config: MachineRuntimeConfig): Worker {
    const jsWorkerPath = join(__dirname, 'machine.worker.js');
    const tsWorkerPath = join(
      process.cwd(),
      'src',
      'module',
      'machine',
      'runtime',
      'machine.worker.ts',
    );

    const options: WorkerOptions = {
      workerData: config,
      env: process.env,
    };

    if (existsSync(jsWorkerPath)) {
      return new Worker(jsWorkerPath, options);
    }

    options.execArgv = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'];
    return new Worker(tsWorkerPath, options);
  }

  private stopWorker(id: string) {
    const entry = this.workers.get(id);
    if (!entry) return;

    if (entry.restartTimer) clearTimeout(entry.restartTimer);
    entry.worker.removeAllListeners('exit');
    entry.worker.postMessage({ type: 'stop' });
    this.workers.delete(id);
    this.logger.log(`Worker stopped [machine ${id}]`);
  }

  private startConfigWatcher() {
    this.watchTimer = setInterval(() => {
      void this.syncWorkerConfigs();
    }, this.watchMs);
    this.watchTimer.unref();
    this.logger.log(`Config watcher started (${this.watchMs}ms)`);
  }

  private async syncWorkerConfigs() {
    try {
      const freshConfigs = await this.machineConfigService.loadConfigs();
      const freshMap = new Map(freshConfigs.map((c) => [String(c.id), c]));
      const runningIds = new Set(this.workers.keys());
      const queuedIds = new Set(this.pendingWorkerConfigs.map((c) => String(c.id)));

      for (const [id, config] of freshMap.entries()) {
        if (!runningIds.has(id) && !queuedIds.has(id)) {
          this.logger.log(`New machine ${id} detected, spawning worker`);
          this.enqueueWorker(config);
        }
      }

      for (const id of runningIds) {
        if (!freshMap.has(id)) {
          this.logger.log(`Machine ${id} removed, stopping worker`);
          this.stopWorker(id);
          this.promoteQueuedWorker();
        }
      }

      // Drop queued machines removed from config before they ever got a slot.
      this.pendingWorkerConfigs = this.pendingWorkerConfigs.filter((c) =>
        freshMap.has(String(c.id)),
      );

      // Drop legacy-state bookkeeping for machines no longer in the active config set.
      for (const id of this.lastState.keys()) {
        if (freshMap.has(id)) continue;
        this.lastState.delete(id);
        this.machineGateway.forgetMachine(id);
      }
      for (const id of this.pendingWrites.keys()) {
        if (!freshMap.has(id)) this.pendingWrites.delete(id);
      }

      for (const [id, fresh] of freshMap.entries()) {
        const entry = this.workers.get(id);
        if (!entry) continue;

        const curr = entry.config;
        const changed: Partial<MachineRuntimeConfig> = {};

        // if (curr.auf_list !== fresh.auf_list) changed.auf_list = fresh.auf_list;
        if (curr.taktzeit !== fresh.taktzeit) changed.taktzeit = fresh.taktzeit;
        if (curr.heating_start !== fresh.heating_start) {
          changed.heating_start = fresh.heating_start;
        }
        if (curr.poll_interval_ms !== fresh.poll_interval_ms) {
          changed.poll_interval_ms = fresh.poll_interval_ms;
        }
        if (curr.request_timeout_ms !== fresh.request_timeout_ms) {
          changed.request_timeout_ms = fresh.request_timeout_ms;
        }

        const invertChanged: Partial<MachineRuntimeConfig['invert']> = {};
        for (const sig of ['F', 'P', 'A', 'ZH', 'HK'] as const) {
          if ((curr.invert?.[sig] ?? false) !== (fresh.invert?.[sig] ?? false)) {
            invertChanged[sig] = fresh.invert[sig];
          }
        }
        if (Object.keys(invertChanged).length) {
          changed.invert = {
            ...(curr.invert ?? fresh.invert),
            ...invertChanged,
          };
        }

        if (Object.keys(changed).length) {
          Object.assign(entry.config, changed);
          entry.worker.postMessage({ type: 'config_update', config: changed });
        }

        if ((curr.transport || 'modbus') === 'modbus' && curr.ip !== fresh.ip) {
          entry.config.ip = fresh.ip;
          entry.worker.postMessage({ type: 'ip_change', ip: fresh.ip });
        }

        if (curr.transport === 'api' && curr.api_url !== fresh.api_url) {
          entry.config.api_url = fresh.api_url;
          entry.worker.postMessage({
            type: 'url_change',
            api_url: fresh.api_url || '',
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Config watcher failed: ${message}`);
    }
  }

  private async stopAll(reason: string) {
    if (this.stopping) return;
    this.stopping = true;

    if (this.watchTimer) clearInterval(this.watchTimer);

    this.machineGateway.broadcastShutdown(reason);
    for (const id of [...this.workers.keys()]) this.stopWorker(id);
    this.pendingWorkerConfigs = [];
    await this.delay(400);
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Legacy-worker-mode counterpart of ChannelMappingService's status
   * persistence: no explicit STATUS field exists in the worker payload, so
   * derive one from the raw A/P flags, and persist only on an actual change.
   */
  private async trackLegacyState(
    machineId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    let stateName = this.deriveLegacyState(payload);
    let machineStateId = await this.resolveLegacyStateId(stateName);
    if (machineStateId === null) return; // canonical row missing — nothing to persist

    // Manual-maintenance override — force MAINTENANCE. Unlike channel-mapping
    // mode there is NO auto-clear branch: the legacy payload has no real ACTIVE
    // confirmation channel, so manual End (the Laravel endpoint clears the
    // Redis override set) is the only way out.
    if (await this.maintenanceOverride.isOverridden(machineId)) {
      const maintenanceId = await this.resolveLegacyStateId('maintenance');
      if (maintenanceId !== null) {
        stateName = 'maintenance';
        machineStateId = maintenanceId;
      }
    }

    if (this.lastState.get(machineId) === machineStateId) return;
    this.lastState.set(machineId, machineStateId);

    try {
      await this.machineStateTracker.recordTransition(machineId, machineStateId, stateName, new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to record state '${stateName}' for machine ${machineId}: ${message}`,
      );
      // Drop the cache entry so the transition is retried on the next signal.
      this.lastState.delete(machineId);
    }
  }

  /**
   * Mirrors the frontend's `deriveActivity()` fallback (no STATUS present):
   * A=1 → active, P=1 → idle, else inactive. No MAINTENANCE/FAULT signal
   * exists in the legacy worker payload, so those states are unreachable in
   * this mode — a pre-existing limitation, not something this change expands.
   */
  private deriveLegacyState(payload: Record<string, unknown>): string {
    if (Number(payload.A) === 1) return 'active';
    if (Number(payload.P) === 1) return 'idle';
    return 'inactive';
  }

  /**
   * Legacy mode has no per-machine channel-mapping config to look up an
   * arbitrary state from (only 2 raw A/P booleans) — it can only ever resolve
   * to one of the 3 canonical rows `MachineStatesSeeder` creates, matched by
   * name. Returns null (and skips persistence) if a canonical row was renamed
   * away or deleted — this mode simply can't represent anything else.
   */
  private async resolveLegacyStateId(stateName: string): Promise<number | null> {
    const statesById = await this.machineConfigService.loadMachineStatesMap();
    for (const meta of statesById.values()) {
      if (meta.name.toLowerCase() === stateName) return meta.id;
    }
    this.logger.warn(`No machine_states row named '${stateName}' — legacy state not persisted`);
    return null;
  }

  // ---------------------------------------------------------------------
  // Worker DB relay — workers hold no PrismaClient of their own; every
  // read/write below runs against this service's single shared pool
  // instead of one independent pool per worker thread.
  // ---------------------------------------------------------------------

  /**
   * Chain same-machine writes in send order against the shared pool. A
   * fire-and-forget relay gives no ordering guarantee across overlapping
   * async calls by itself — two rapid writes for one machine could otherwise
   * race and the slower one clobber the faster one's result.
   */
  private serializeWrite(machineId: string, task: () => Promise<void>): void {
    const previous = this.pendingWrites.get(machineId) ?? Promise.resolve();
    const next = previous.then(task, task).catch(() => undefined);
    this.pendingWrites.set(machineId, next);
  }

  /**
   * Always replies with a `counter_result`, even on failure (`counter: null`)
   * — the worker's `loadInitialState()` awaits this response to start its
   * transport; a swallowed exception here would otherwise hang that worker
   * at startup forever with no retry and no error surfaced.
   */
  private async handleGetCounter(
    worker: Worker,
    machineId: string,
    requestId: string,
  ): Promise<void> {
    const id = this.parseMachineId(machineId);
    let counter: { shot_nr: number; last_cycle_time: number; cycle_time: number } | null = null;

    if (id !== null) {
      try {
        counter = await this.prisma.machine_counters.findFirst({
          where: { masch_id: id },
          select: { shot_nr: true, last_cycle_time: true, cycle_time: true },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Counter fetch error [machine ${machineId}]: ${message}`);
      }
    }

    worker.postMessage({ type: 'counter_result', requestId, counter });
  }

  private async handleSaveCounter(
    machineId: string,
    shotNr: number,
    lastCycleTime: number,
    cycleTime: number,
  ): Promise<void> {
    const id = this.parseMachineId(machineId);
    if (id === null) return;

    const data = {
      shot_nr: this.toUInt(shotNr),
      last_cycle_time: this.toUInt(lastCycleTime),
      cycle_time: this.toUInt(cycleTime),
    };

    try {
      const existing = await this.prisma.machine_counters.findFirst({
        where: { masch_id: id },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.machine_counters.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.machine_counters.create({ data: { masch_id: id, ...data } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Counter save error [machine ${machineId}]: ${message}`);
    }
  }

  private async handleSetHeatingStart(machineId: string, timestamp: string): Promise<void> {
    const id = this.parseMachineId(machineId);
    if (id === null) return;

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return;

    try {
      await this.prisma.machine_has_configs.updateMany({
        where: { machine_id: id, is_active: true },
        data: { heating_start: date },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Heating start save error [machine ${machineId}]: ${message}`);
    }
  }

  private async handleClearHeatingStart(machineId: string): Promise<void> {
    const id = this.parseMachineId(machineId);
    if (id === null) return;

    try {
      await this.prisma.machine_has_configs.updateMany({
        where: { machine_id: id, is_active: true },
        data: { heating_start: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Heating start clear error [machine ${machineId}]: ${message}`);
    }
  }

  /**
   * Bucketed production history for reporting (achieved/ok/waste on the machine
   * overview page) — one row per machine per calendar day, incremented per shot.
   * Separate from `machine_counters` (untouched), which keeps the live cumulative
   * needle. No reject/scrap signal exists in acquisition yet, so `isGood` is
   * always true today — total_count tracks shots, scrap_count stays 0 until a
   * real reject channel exists (see enhancement plan, Phase 1.5/3).
   */
  private async handleRecordProductionShot(machineId: string, isGood: boolean): Promise<void> {
    const id = this.parseMachineId(machineId);
    if (id === null) return;

    const bucketStart = new Date();
    bucketStart.setHours(0, 0, 0, 0);
    const now = new Date();

    try {
      const existing = await this.prisma.machine_production_counts.findFirst({
        where: { machine_id: id, bucket_started_at: bucketStart },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.machine_production_counts.update({
          where: { id: existing.id },
          data: {
            bucket_ended_at: now,
            good_count: { increment: isGood ? 1 : 0 },
            scrap_count: { increment: isGood ? 0 : 1 },
            total_count: { increment: 1 },
          },
        });
        return;
      }

      await this.prisma.machine_production_counts.create({
        data: {
          machine_id: id,
          bucket_started_at: bucketStart,
          bucket_ended_at: now,
          good_count: isGood ? 1 : 0,
          scrap_count: isGood ? 0 : 1,
          total_count: 1,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Production count save error [machine ${machineId}]: ${message}`);
    }
  }

  private toUInt(value: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  private parseMachineId(machineId: string): bigint | null {
    const n = Number(machineId);
    if (!Number.isFinite(n) || n <= 0) return null;
    return BigInt(Math.floor(n));
  }
}
