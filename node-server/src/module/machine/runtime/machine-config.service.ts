import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { GetRedisClient } from 'config/redis/config.redis';
import {
  ChannelReadFrom,
  ChannelRuntimeConfig,
  ChannelStatusEntry,
  DEFAULT_CHANNEL_READ_FROM,
  MachineInvertConfig,
  MachineRuntimeConfig,
  MachineStateMeta,
  MachineTransport,
} from './machine-runtime.types';

const DEFAULT_INVERT: MachineInvertConfig = {
  F: false,
  P: false,
  A: false,
  ZH: false,
  HK: false,
};

/** Raw (pre-override, pre-normalization) shape cached in Redis. */
type RawLeanRow = {
  id: string;
  ip_plc: string;
  id_iot: string | null;
  live_status_api: string | null;
  server_call_sec: number | null;
  timeout_sec: number | null;
  read_from: string | null;
  channels: ChannelStatusEntry[];
  default_machine_state_id: number | null;
};

/**
 * Full (pre-override, pre-normalization) shape cached in Redis for the legacy
 * worker path's `loadConfigs()` — `RawLeanRow` plus the invert flags and
 * transport fields the channel poller never needs. IDs and dates are already
 * strings (never `bigint`/`Date`) so the row is JSON-safe for Redis as-is.
 */
type RawFullRow = RawLeanRow & {
  heating_start: string | null;
  invert: MachineInvertConfig;
  transport: MachineTransport;
  api_url: string | null;
  api_signal_map: Record<string, number> | null;
};

@Injectable()
export class MachineConfigService {
  private readonly logger = new Logger(MachineConfigService.name);
  private readonly overrideFile = join(
    process.cwd(),
    'src',
    'module',
    'machine',
    'machines.json',
  );

  private readonly redis = GetRedisClient();
  private readonly channelCacheKey = 'machine:channel_configs';
  private readonly runtimeConfigCacheKey = 'machine:runtime_configs';
  private readonly statesMapCacheKey = 'machine:states_map';
  private readonly channelCacheTtlMs = Number(
    process.env.MACHINE_CONFIG_CACHE_TTL_MS ?? 10000,
  );

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full config load for the legacy per-machine worker path (invert flags +
   * shot-counting transport, on top of what `loadChannelConfigs()` needs).
   * Redis-cached like `loadChannelConfigs()` — `syncWorkerConfigs` polls this
   * every `MACHINE_WATCH_MS` (default 30s), so without a cache it re-runs a
   * full 4-table join every cycle even when nothing changed. `machines.json`
   * overrides are always applied fresh (never cached — local to this instance).
   */
  async loadConfigs(): Promise<MachineRuntimeConfig[]> {
    const overrides = this.readOverrides();
    const rawRows = await this.loadRawFullRows();

    const configs: MachineRuntimeConfig[] = [];
    for (const row of rawRows) {
      const override = overrides[row.id] ?? {};
      const overrideInvert = (override.invert ?? {}) as Partial<MachineInvertConfig>;
      const transport = this.resolveTransport(override.transport, row.transport);

      configs.push({
        id: row.id,
        ip: String(override.ip ?? row.ip_plc ?? ''),
        taktzeit: this.toPositiveInt(override.taktzeit ?? 999, 999),
        heating_start: this.normalizeDateValue(
          override.heating_start ?? row.heating_start,
        ),
        enabled:
          override.enabled === undefined ? true : Boolean(override.enabled),
        transport,
        api_url: this.normalizeNullableString(
          override.api_url ?? row.api_url ?? null,
        ),
        api_signal_map: this.resolveSignalMap(
          override.api_signal_map ?? row.api_signal_map ?? null,
        ),
        invert: {
          F: overrideInvert.F ?? row.invert.F ?? DEFAULT_INVERT.F,
          P: overrideInvert.P ?? row.invert.P ?? DEFAULT_INVERT.P,
          A: overrideInvert.A ?? row.invert.A ?? DEFAULT_INVERT.A,
          ZH: overrideInvert.ZH ?? row.invert.ZH ?? DEFAULT_INVERT.ZH,
          HK: overrideInvert.HK ?? row.invert.HK ?? DEFAULT_INVERT.HK,
        },
        poll_interval_ms: this.resolveMs(
          override.server_call_sec ?? row.server_call_sec,
        ),
        request_timeout_ms: this.resolveMs(
          override.timeout_sec ?? row.timeout_sec,
        ),
        live_status_api: this.normalizeNullableString(
          override.live_status_api ?? row.live_status_api ?? null,
        ),
        channels: this.resolveChannels(override.channels ?? row.channels),
        default_machine_state_id: row.default_machine_state_id,
        channel_read_from: this.resolveChannelReadFrom(
          override.read_from ?? row.read_from,
          row.id,
        ),
      });
    }

    const activeConfigs = configs.filter((c) => c.enabled);
    for (const c of activeConfigs) {
      const inv = Object.entries(c.invert)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const tStr = c.transport === 'api' ? `api (${c.api_url})` : `modbus (${c.ip})`;
      // this.logger.log(
      //   `Machine ${c.id} - ${tStr}${inv.length ? ` | inverted: ${inv.join(', ')}` : ''}`,
      // );
    }
    return activeConfigs;
  }

  /**
   * Lean, Redis-cached config load for `ChannelMappingService`'s poll loop.
   * Only queries `machine_has_configs` (narrow select) + `config_has_channels`
   * — skips `machine_signals`/`machine_transport_configs` entirely, since the
   * channel poller never needs invert flags or the legacy shot-counting
   * transport. MySQL is only hit once per `MACHINE_CONFIG_CACHE_TTL_MS`
   * window instead of once per tick; `machines.json` overrides are always
   * applied fresh (never cached — they're local to this node-server instance).
   */
  async loadChannelConfigs(): Promise<ChannelRuntimeConfig[]> {
    const overrides = this.readOverrides();
    const rawRows = await this.loadRawLeanRows();

    const configs: ChannelRuntimeConfig[] = [];
    for (const row of rawRows) {
      const override = overrides[row.id] ?? {};

      configs.push({
        id: row.id,
        ip: String(override.ip ?? row.ip_plc ?? ''),
        id_iot: this.normalizeNullableString(override.id_iot ?? row.id_iot ?? null),
        channel_read_from: this.resolveChannelReadFrom(
          override.read_from ?? row.read_from,
          row.id,
        ),
        poll_interval_ms: this.resolveMs(
          override.server_call_sec ?? row.server_call_sec,
        ),
        request_timeout_ms: this.resolveMs(
          override.timeout_sec ?? row.timeout_sec,
        ),
        live_status_api: this.normalizeNullableString(
          override.live_status_api ?? row.live_status_api ?? null,
        ),
        channels: this.resolveChannels(override.channels ?? row.channels),
        default_machine_state_id: row.default_machine_state_id,
      });
    }

    return configs;
  }

  /**
   * Admin-editable state vocabulary (id, name, priority, counts_as_productive)
   * — replaces the old hardcoded ACTIVE/IDLE/INACTIVE/MAINTENANCE/FAULT set.
   * Redis-cached same as the channel/runtime configs (this table is tiny —
   * a handful of rows — but it's read once per tier tick across every machine
   * in that tier, so still worth caching rather than re-querying every time).
   */
  async loadMachineStatesMap(): Promise<Map<number, MachineStateMeta>> {
    try {
      const cached = await this.redis.get(this.statesMapCacheKey);
      if (cached) {
        const rows = JSON.parse(cached) as MachineStateMeta[];
        return new Map(rows.map((row) => [row.id, row]));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`States map cache read failed, querying MySQL: ${message}`);
    }

    const rows = await this.prisma.machine_states.findMany({
      where: { is_active: true },
      select: { id: true, name: true, priority: true, counts_as_productive: true, color: true },
    });
    const metas: MachineStateMeta[] = rows.map((row) => ({
      id: Number(row.id),
      name: row.name ?? `State ${row.id}`,
      priority: row.priority,
      counts_as_productive: row.counts_as_productive,
      color: row.color,
    }));

    try {
      await this.redis.set(
        this.statesMapCacheKey,
        JSON.stringify(metas),
        'PX',
        this.channelCacheTtlMs,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`States map cache write failed: ${message}`);
    }

    return new Map(metas.map((meta) => [meta.id, meta]));
  }

  /** Cache-first raw lean rows: Redis hit, else MySQL + repopulate Redis. */
  private async loadRawLeanRows(): Promise<RawLeanRow[]> {
    try {
      const cached = await this.redis.get(this.channelCacheKey);
      if (cached) return JSON.parse(cached) as RawLeanRow[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Channel config cache read failed, querying MySQL: ${message}`);
    }

    const rows = await this.fetchRawLeanRowsFromDb();

    try {
      await this.redis.set(
        this.channelCacheKey,
        JSON.stringify(rows),
        'PX',
        this.channelCacheTtlMs,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Channel config cache write failed: ${message}`);
    }

    return rows;
  }

  /** Cache-first raw full rows: Redis hit, else MySQL + repopulate Redis. */
  private async loadRawFullRows(): Promise<RawFullRow[]> {
    try {
      const cached = await this.redis.get(this.runtimeConfigCacheKey);
      if (cached) return JSON.parse(cached) as RawFullRow[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Runtime config cache read failed, querying MySQL: ${message}`);
    }

    const rows = await this.fetchRawFullRowsFromDb();

    try {
      await this.redis.set(
        this.runtimeConfigCacheKey,
        JSON.stringify(rows),
        'PX',
        this.channelCacheTtlMs,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Runtime config cache write failed: ${message}`);
    }

    return rows;
  }

  private async fetchRawFullRowsFromDb(): Promise<RawFullRow[]> {
    const [locationRows, signalRows, transportRows, channelRows, defaultStateRows] =
      await Promise.all([
        this.prisma.machine_has_configs.findMany({
          where: { is_active: true },
          select: {
            id: true,
            machine_id: true,
            ip_plc: true,
            id_iot: true,
            heating_start: true,
            live_status_api: true,
            server_call_sec: true,
            timeout_sec: true,
            read_from: true,
          },
        }),
        this.prisma.machine_signals.findMany({
          select: {
            masch_id: true,
            invert_F: true,
            invert_P: true,
            invert_A: true,
            invert_ZH: true,
            invert_HK: true,
          },
        }),
        this.prisma.machine_transport_configs.findMany({
          select: {
            masch_id: true,
            transport: true,
            api_url: true,
            api_signal_map: true,
          },
        }),
        this.prisma.config_has_channels.findMany({
          where: { machine_state_id: { not: null } },
          select: { config_id: true, channel_id: true, machine_state_id: true },
        }),
        this.prisma.machine_has_states.findMany({
          where: { is_default: true },
          select: { machine_id: true, machine_state_id: true },
        }),
      ]);

    const defaultStateMap = this.buildDefaultStateMap(defaultStateRows);

    const signalMap = new Map<string, MachineInvertConfig>();
    for (const row of signalRows) {
      signalMap.set(String(row.masch_id), {
        F: !!row.invert_F,
        P: !!row.invert_P,
        A: !!row.invert_A,
        ZH: !!row.invert_ZH,
        HK: !!row.invert_HK,
      });
    }

    const transportMap = new Map<
      string,
      {
        transport: MachineTransport;
        api_url: string | null;
        api_signal_map: Record<string, number> | null;
      }
    >();

    for (const row of transportRows) {
      const transport =
        String(row.transport).toLowerCase() === 'api' ? 'api' : 'modbus';
      const rawSignalMap = row.api_signal_map;
      const parsedSignalMap =
        rawSignalMap && typeof rawSignalMap === 'object'
          ? (rawSignalMap as Record<string, number>)
          : null;

      transportMap.set(String(row.masch_id), {
        transport,
        api_url: row.api_url ?? null,
        api_signal_map: parsedSignalMap,
      });
    }

    const channelMap = this.buildChannelMap(channelRows);

    const rows: RawFullRow[] = [];
    for (const row of locationRows) {
      const id = String(row.machine_id ?? '').trim();
      if (!id) continue;

      const invert = signalMap.get(id) ?? DEFAULT_INVERT;
      const dbTransport = transportMap.get(id);

      rows.push({
        id,
        ip_plc: String(row.ip_plc ?? ''),
        id_iot: row.id_iot?.trim() || null,
        heating_start: row.heating_start ? row.heating_start.toISOString() : null,
        live_status_api: row.live_status_api ?? null,
        server_call_sec: row.server_call_sec ?? null,
        timeout_sec: row.timeout_sec ?? null,
        read_from: row.read_from ?? null,
        channels: channelMap.get(String(row.id)) ?? [],
        default_machine_state_id: defaultStateMap.get(id) ?? null,
        invert,
        transport: dbTransport?.transport ?? 'modbus',
        api_url: dbTransport?.api_url ?? null,
        api_signal_map: dbTransport?.api_signal_map ?? null,
      });
    }

    return rows;
  }

  private async fetchRawLeanRowsFromDb(): Promise<RawLeanRow[]> {
    const [locationRows, channelRows, defaultStateRows] = await Promise.all([
      this.prisma.machine_has_configs.findMany({
        where: { is_active: true },
        select: {
          id: true,
          machine_id: true,
          ip_plc: true,
          id_iot: true,
          live_status_api: true,
          server_call_sec: true,
          timeout_sec: true,
          read_from: true,
        },
      }),
      this.prisma.config_has_channels.findMany({
        where: { machine_state_id: { not: null } },
        select: { config_id: true, channel_id: true, machine_state_id: true },
      }),
      this.prisma.machine_has_states.findMany({
        where: { is_default: true },
        select: { machine_id: true, machine_state_id: true },
      }),
    ]);

    const channelMap = this.buildChannelMap(channelRows);
    const defaultStateMap = this.buildDefaultStateMap(defaultStateRows);

    const rows: RawLeanRow[] = [];
    for (const row of locationRows) {
      const id = String(row.machine_id ?? '').trim();
      if (!id) continue;

      rows.push({
        id,
        ip_plc: String(row.ip_plc ?? ''),
        id_iot: row.id_iot?.trim() || null,
        live_status_api: row.live_status_api ?? null,
        server_call_sec: row.server_call_sec ?? null,
        timeout_sec: row.timeout_sec ?? null,
        read_from: row.read_from ?? null,
        channels: channelMap.get(String(row.id)) ?? [],
        default_machine_state_id: defaultStateMap.get(id) ?? null,
      });
    }
    return rows;
  }

  /**
   * Group `config_has_channels` rows by their owning config PK
   * (config_id → machine_has_configs.id), dropping malformed rows.
   */
  private buildChannelMap(
    channelRows: Array<{ config_id: unknown; channel_id: unknown; machine_state_id: unknown }>,
  ): Map<string, ChannelStatusEntry[]> {
    const channelMap = new Map<string, ChannelStatusEntry[]>();
    for (const row of channelRows) {
      const configId = String(row.config_id ?? '').trim();
      const channelId = Number(row.channel_id);
      const machineStateId = Number(row.machine_state_id);
      if (!configId || !Number.isFinite(channelId) || !Number.isFinite(machineStateId)) continue;

      const list = channelMap.get(configId) ?? [];
      list.push({ channel_id: channelId, machine_state_id: machineStateId });
      channelMap.set(configId, list);
    }
    return channelMap;
  }

  /** Group `machine_has_states` rows tagged `is_default` by `machine_id` — at most one expected per machine. */
  private buildDefaultStateMap(
    defaultStateRows: Array<{ machine_id: unknown; machine_state_id: unknown }>,
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of defaultStateRows) {
      const machineId = String(row.machine_id ?? '').trim();
      const machineStateId = Number(row.machine_state_id);
      if (!machineId || !Number.isFinite(machineStateId)) continue;
      map.set(machineId, machineStateId);
    }
    return map;
  }

  private readOverrides(): Record<string, Record<string, unknown>> {
    if (!existsSync(this.overrideFile)) return {};

    try {
      const content = JSON.parse(readFileSync(this.overrideFile, 'utf8'));
      if (!Array.isArray(content)) return {};

      const map: Record<string, Record<string, unknown>> = {};
      for (const item of content) {
        const id = String(item?.id ?? '').trim();
        if (!id) continue;
        map[id] = item as Record<string, unknown>;
      }
      return map;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to parse machines.json override: ${message}`);
      return {};
    }
  }

  private resolveTransport(
    overrideTransport: unknown,
    dbTransport?: MachineTransport,
  ): MachineTransport {
    const value = String(overrideTransport ?? dbTransport ?? 'modbus').toLowerCase();
    return value === 'api' ? 'api' : 'modbus';
  }

  /**
   * Normalize a channel entry list into typed entries. Accepts the DB-derived
   * list or a `machines.json` override (parsed array or JSON string).
   * Drops malformed rows.
   */
  private resolveChannels(value: unknown): ChannelStatusEntry[] {
    let list = value;
    if (typeof list === 'string') {
      try {
        list = JSON.parse(list);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(list)) return [];

    const entries: ChannelStatusEntry[] = [];
    for (const item of list) {
      const record = item as Record<string, unknown>;
      const channelId = Number(record?.channel_id);
      const machineStateId = Number(record?.machine_state_id);
      if (Number.isFinite(channelId) && Number.isFinite(machineStateId)) {
        entries.push({ channel_id: channelId, machine_state_id: machineStateId });
      }
    }
    return entries;
  }

  /**
   * Normalize the channel-status acquisition transport. Falls back to
   * `DEFAULT_CHANNEL_READ_FROM` for null/empty/unrecognized values (e.g. the
   * stale legacy `'CHANNEL'` value) — warns only when a non-empty value was
   * actually rejected, so mass-null configs stay quiet.
   */
  private resolveChannelReadFrom(value: unknown, machineId: string): ChannelReadFrom {
    const raw = String(value ?? '').trim();
    const upper = raw.toUpperCase();
    if (upper === 'MQTT' || upper === 'API' || upper === 'MODBUS') {
      return upper;
    }
    if (raw) {
      this.logger.warn(
        `Machine ${machineId}: unrecognized read_from '${raw}', defaulting to ${DEFAULT_CHANNEL_READ_FROM}`,
      );
    }
    return DEFAULT_CHANNEL_READ_FROM;
  }

  private resolveSignalMap(value: unknown): Record<string, number> | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    const out: Record<string, number> = {};

    for (const key of ['F', 'P', 'A', 'ZH', 'HK']) {
      const n = Number(v[key]);
      if (Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
    }
    return Object.keys(out).length ? out : null;
  }

  /** Convert a DB seconds value to ms; null when unset / not positive. */
  private resolveMs(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n) * 1000;
  }

  private toPositiveInt(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
  }

  private normalizeNullableString(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
  }

  private normalizeDateValue(value: unknown): string | null {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }
}
