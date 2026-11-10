import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { socketService } from 'config/socket/socket.config';
import {
  buildChannelCounters,
  buildChannelLookup,
  ChannelAcquisition,
} from './channel-lookup.util';

/** Single source of truth for the flag — also read by MqttChannelSource. */
export const isMachineDataSocketEnabled = (): boolean =>
  process.env.MACHINE_DATA_SOCKET === 'true';

type CacheEntry = {
  inputs: boolean[];
  counts: number[];
  /** Epoch ms of the last *successful* reading (drives lastSeenAt). */
  receivedAt: number;
  /** false after the microservice reports the device unreachable. */
  online: boolean;
};

type DeviceStatusPayload = {
  source_ip?: unknown;
  online?: unknown;
  error?: unknown;
  data?: { inputs?: unknown; counts?: unknown } | null;
};

/**
 * Push-based channel source fed by qpail-microservice over the shared
 * Socket.IO server. Drop-in replacement for MqttChannelSource behind
 * read_from='MQTT' when MACHINE_DATA_SOCKET=true — same cache shape, same
 * getLatestForMachine()/getLastReceivedAt() contract, keyed by IP.
 */
@Injectable()
export class SocketChannelSource implements OnModuleInit {
  private readonly logger = new Logger(SocketChannelSource.name);

  readonly enabled = isMachineDataSocketEnabled();
  private readonly event = process.env.MACHINE_DATA_SOCKET_EVENT || 'qpail-device:status';
  private readonly token = process.env.MACHINE_DATA_SOCKET_TOKEN || '';
  private readonly stalenessMs = Number(process.env.MACHINE_DATA_SOCKET_STALENESS_MS ?? 10000);
  private readonly verbosePollLogging = process.env.CHANNEL_POLL_DEBUG_LOG === 'true';
  private readonly readCountsEnabled = process.env.CHANNEL_READ_COUNTS === 'true';

  private readonly cache = new Map<string, CacheEntry>();

  onModuleInit(): void {
    if (!this.enabled) return;

    // socketService is initialized in main.ts before app.listen(), i.e. before onModuleInit runs.
    socketService.onConnection((socket) => {
      const authorized = !this.token || socket.handshake?.auth?.token === this.token;
      let warned = false;
      socket.on(this.event, (payload: DeviceStatusPayload) => {
        if (!authorized) {
          // Never disconnect: the same server serves the Angular app.
          if (!warned) {
            this.logger.warn(`Rejected '${this.event}' from ${socket.id}: bad or missing auth.token`);
            warned = true;
          }
          return;
        }
        this.handleMessage(payload);
      });
    });

    this.logger.log(
      `MACHINE_DATA_SOCKET=true — read_from=MQTT machines read from Socket.IO event '${this.event}'` +
        ` (staleness ${this.stalenessMs}ms${this.token ? ', token required' : ''})`,
    );
  }

  private handleMessage(payload: DeviceStatusPayload): void {
    const ip = typeof payload?.source_ip === 'string' ? payload.source_ip.trim() : '';
    if (!ip) {
      this.logger.error(`Socket poll failed: '${this.event}' payload has no 'source_ip'`);
      return;
    }

    // Device unreachable: mark offline immediately instead of waiting for the staleness
    // window. receivedAt is kept so lastSeenAt still shows the last good reading.
    if (payload.online !== true) {
      const entry = this.cache.get(ip);
      if (entry) entry.online = false;
      if (this.verbosePollLogging) {
        this.logger.log(`Socket poll: ${ip} offline (${String(payload.error ?? 'unknown')})`);
      }
      return;
    }

    const inputs = payload.data?.inputs;
    if (!Array.isArray(inputs)) {
      this.logger.error(`Socket poll failed: '${this.event}' from ${ip} has no 'data.inputs' array`);
      return;
    }

    // Same in-place mutation strategy as MqttChannelSource.handleMessage — getLatest*() hands out copies.
    let entry = this.cache.get(ip);
    if (!entry) {
      entry = {
        inputs: inputs.map(Boolean),
        counts: new Array(10).fill(0),
        receivedAt: Date.now(),
        online: true,
      };
      this.cache.set(ip, entry);
    } else if (entry.inputs.length === inputs.length) {
      for (let i = 0; i < inputs.length; i++) entry.inputs[i] = Boolean(inputs[i]);
    } else {
      entry.inputs = inputs.map(Boolean);
    }

    if (this.readCountsEnabled) {
      const rawCounts = payload.data?.counts;
      const counts = buildChannelCounters(Array.isArray(rawCounts) ? rawCounts : []);
      if (entry.counts.length === counts.length) {
        for (let i = 0; i < counts.length; i++) entry.counts[i] = counts[i];
      } else {
        entry.counts = counts;
      }
    }

    entry.online = true;
    entry.receivedAt = Date.now();

    if (this.verbosePollLogging) {
      this.logger.log(
        `Socket poll OK: ${ip} inputs=${JSON.stringify(entry.inputs)}` +
          (this.readCountsEnabled ? ` counts=${JSON.stringify(entry.counts)}` : ''),
      );
    }
  }

  /** Same signature as MqttChannelSource; id_iot is ignored (socket mode keys by IP). */
  getLatestForMachine(ip: string | null, _idIot: string | null): ChannelAcquisition | null {
    const key = ip?.trim();
    if (!key) return null;
    const entry = this.cache.get(key);
    if (!entry || !entry.online) return null;
    if (Date.now() - entry.receivedAt > this.stalenessMs) return null;
    return {
      lookup: buildChannelLookup(entry.inputs),
      inputs: entry.inputs.slice(),
      counts: entry.counts.slice(),
    };
  }

  /** Last successful reading, not gated by staleness/online (drives lastSeenAt). */
  getLastReceivedAt(ip: string | null, _idIot: string | null): number | null {
    const key = ip?.trim();
    if (!key) return null;
    return this.cache.get(key)?.receivedAt ?? null;
  }
}
