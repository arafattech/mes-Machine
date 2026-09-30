import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import {
  buildChannelCounters,
  buildChannelLookup,
  ChannelAcquisition,
} from './channel-lookup.util';
import { MachineConfigService } from './machine-config.service';
import { ChannelRuntimeConfig } from './machine-runtime.types';

type CacheEntry = {
  inputs: boolean[];
  counts: number[];
  receivedAt: number;
};

/** Which machine field identifies a device in this deployment's MQTT topic/payload. */
type MatchField = 'ip' | 'id_iot';

/**
 * Live cache of the latest channel `inputs` reading per device, fed by a
 * single shared MQTT broker connection — one subscription total, not one per
 * machine. MQTT is pub/sub, not poll-based: this connects and subscribes
 * once, then `ChannelMappingService` reads the cache synchronously on each
 * tick instead of issuing a live fetch.
 *
 * The device identifier can be either the machine's `ip_plc` or its
 * `id_iot` (some firmware publishes by a stable device ID rather than a
 * DHCP-assigned IP) — whichever `MQTT_TOPIC_TEMPLATE`/`MQTT_MATCH_FIELD`
 * selects, consistently for topic subscription, per-message extraction, and
 * cache lookup:
 *   - Per-device `{ip}` topic, e.g. `machines/{ip}/status` — subscribes with
 *     a `+` wildcard in the placeholder's place; the matched field comes from
 *     that topic segment on each incoming message.
 *   - Per-device `{id_iot}` topic, e.g. `devices/{id_iot}/status` — unlike
 *     `{ip}`, this is **not** a broker-wide wildcard subscription. Instead it
 *     subscribes explicitly, one topic per known device, built by
 *     substituting each `machine_has_configs.id_iot` (for machines with
 *     `read_from='MQTT'`) into the template. The device list comes from
 *     `MachineConfigService.loadChannelConfigs()` (Redis-cached, same rows
 *     `ChannelMappingService` already polls) and is re-checked every
 *     `MQTT_TOPIC_WATCH_MS`; newly-added devices get subscribed, removed
 *     devices get unsubscribed and evicted from the cache. Exactly one
 *     placeholder type (`{ip}` or `{id_iot}`) may appear in the template,
 *     not both.
 *   - One shared flat topic, e.g. `machine/status` (no placeholder) —
 *     subscribed literally; the matched field is read from the JSON
 *     payload's `ip` or `id_iot` field instead (`MQTT_MATCH_FIELD`, default
 *     `ip`), since the topic alone can't distinguish devices.
 */
@Injectable()
export class MqttChannelSource implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttChannelSource.name);

  private readonly brokerUrl = process.env.MQTT_BROKER_URL ?? '';
  private readonly username = process.env.MQTT_USERNAME || undefined;
  private readonly password = process.env.MQTT_PASSWORD || undefined;
  private readonly topicTemplate =
    process.env.MQTT_TOPIC_TEMPLATE ?? 'machine/status';
  // Only consulted for a flat (placeholder-less) topic — a templated topic's
  // placeholder type (`{ip}` vs `{id_iot}`) already says which field to use.
  private readonly flatMatchField: MatchField =
    process.env.MQTT_MATCH_FIELD === 'id_iot' ? 'id_iot' : 'ip';
  private readonly stalenessMs = Number(process.env.MQTT_STALENESS_MS ?? 15000);
  // Only used in `{id_iot}`-templated mode — cadence for re-checking the DB's
  // device list and diffing subscriptions against it.
  private readonly topicWatchMs = Number(process.env.MQTT_TOPIC_WATCH_MS ?? 5000);
  // Success-path poll logging is high-volume at scale — off by default in
  // production; failures always log regardless of this flag.
  private readonly verbosePollLogging = process.env.CHANNEL_POLL_DEBUG_LOG === 'true';
  // Off by default — same flag ChannelMappingService uses for API/MODBUS, kept
  // in sync here so all three transports honor one on/off switch even though
  // MQTT already gets counts for free in the same published message.
  private readonly readCountsEnabled = process.env.CHANNEL_READ_COUNTS === 'true';

  private client?: MqttClient;
  // Index of the placeholder segment within the '/'-split topic template;
  // -1 when the template has no placeholder (flat-topic mode).
  private placeholderSegmentIndex = -1;
  // Which field the placeholder segment represents — only meaningful when
  // placeholderSegmentIndex !== -1; falls back to flatMatchField otherwise.
  private placeholderField: MatchField = 'ip';
  private readonly cache = new Map<string, CacheEntry>();
  // `{id_iot}`-templated mode only. `id_iot` can itself contain '/' (e.g. a
  // full topic string like `machine/status`), so the incoming topic can't be
  // reversed back to an id_iot by positional segment-splitting — this map is
  // built directly from the same substitution used to construct the
  // subscribe list, keyed by the exact literal topic subscribed to. Its keys
  // double as "currently subscribed topics" for diffing.
  private topicToIdIot = new Map<string, string>();
  private topicWatcherTimer?: NodeJS.Timeout;
  private dbDrivenIdIot = false;

  constructor(private readonly machineConfigService: MachineConfigService) {}

  onModuleInit(): void {
    if (!this.brokerUrl) return;

    const segments = this.topicTemplate.split('/');
    const ipIndexes: number[] = [];
    const idIotIndexes: number[] = [];
    segments.forEach((seg, i) => {
      if (seg === '{ip}') ipIndexes.push(i);
      if (seg === '{id_iot}') idIotIndexes.push(i);
    });

    if (ipIndexes.length + idIotIndexes.length > 1) {
      this.logger.error(
        `MQTT_TOPIC_TEMPLATE '${this.topicTemplate}' has more than one placeholder segment — MQTT channel source disabled.`,
      );
      return;
    }

    if (ipIndexes.length === 1) {
      this.placeholderSegmentIndex = ipIndexes[0];
      this.placeholderField = 'ip';
    } else if (idIotIndexes.length === 1) {
      this.placeholderSegmentIndex = idIotIndexes[0];
      this.placeholderField = 'id_iot';
    }

    this.dbDrivenIdIot = this.placeholderSegmentIndex !== -1 && this.placeholderField === 'id_iot';
    const subscribeTopic =
      this.placeholderSegmentIndex === -1
        ? this.topicTemplate
        : segments
            .map((seg, i) => (i === this.placeholderSegmentIndex ? '+' : seg))
            .join('/');

    // mqtt.connect() throws synchronously on a malformed URL (e.g. missing
    // protocol) — never let a bad MQTT_BROKER_URL crash the whole process.
    try {
      this.client = connect(this.normalizeBrokerUrl(this.brokerUrl), {
        username: this.username,
        password: this.password,
        reconnectPeriod: 5000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `MQTT connect failed: '${this.brokerUrl}' — ${message}. MQTT channel source disabled.`,
      );
      return;
    }

    if (this.dbDrivenIdIot) {
      this.client.on('connect', () => {
        // The broker forgets subscriptions across a reconnect — reassert every
        // previously-known topic unconditionally, then let the periodic refresh
        // below pick up anything that changed while disconnected.
        if (this.topicToIdIot.size) {
          this.client?.subscribe([...this.topicToIdIot.keys()], (error) => {
            if (error) this.logger.error(`MQTT resubscribe failed: ${error.message}`);
          });
        }
        void this.refreshDbDrivenTopics(segments, this.placeholderSegmentIndex).then(() => {
          this.logger.log(
            `MQTT connected — ${this.topicToIdIot.size} device topic(s) subscribed from DB (id_iot)`,
          );
        });
        if (!this.topicWatcherTimer) this.scheduleTopicWatcher(segments, this.placeholderSegmentIndex);
      });
    } else {
      this.client.on('connect', () => {
        this.client?.subscribe(subscribeTopic, (error) => {
          if (error) {
            this.logger.error(`MQTT subscribe failed: ${error.message}`);
            return;
          }
          this.logger.log(`MQTT connected — subscribed to '${subscribeTopic}'`);
        });
      });
    }

    this.client.on('reconnect', () => this.logger.warn('MQTT reconnecting...'));
    this.client.on('close', () => this.logger.warn('MQTT connection closed'));
    this.client.on('error', (error) => this.logger.error(`MQTT error: ${error.message}`));
    this.client.on('message', (topic, payload) => this.handleMessage(topic, payload));
  }

  /** `mqtt.connect()` requires a protocol — default to `mqtt://` when missing. */
  private normalizeBrokerUrl(url: string): string {
    return /^\w+:\/\//.test(url) ? url : `mqtt://${url}`;
  }

  /**
   * `{id_iot}`-templated mode only: re-derive the target topic set from the
   * DB (via `MachineConfigService.loadChannelConfigs()` — Redis-cached, the
   * same rows `ChannelMappingService` already polls every tick, so this adds
   * no new Prisma query) and diff it against what's currently subscribed.
   * Newly-added machines get subscribed; machines no longer configured for
   * `read_from='MQTT'` (or removed/disabled) get unsubscribed and their
   * cached reading evicted, so a stale device doesn't linger forever.
   */
  private async refreshDbDrivenTopics(segments: string[], placeholderIndex: number): Promise<void> {
    let configs: ChannelRuntimeConfig[];
    try {
      configs = await this.machineConfigService.loadChannelConfigs();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`MQTT topic refresh failed: ${message}`);
      return;
    }

    const target = new Map<string, string>();
    for (const config of configs) {
      if (config.channel_read_from !== 'MQTT' || !config.id_iot) continue;
      const topic = segments.map((seg, i) => (i === placeholderIndex ? config.id_iot! : seg)).join('/');
      target.set(topic, config.id_iot);
    }

    const added = [...target.keys()].filter((topic) => !this.topicToIdIot.has(topic));
    const removed = [...this.topicToIdIot.keys()].filter((topic) => !target.has(topic));

    if (added.length && this.client) {
      this.client.subscribe(added, (error) => {
        if (error) this.logger.error(`MQTT subscribe failed for new device topic(s): ${error.message}`);
      });
    }
    if (removed.length && this.client) {
      this.client.unsubscribe(removed, (error) => {
        if (error) this.logger.error(`MQTT unsubscribe failed: ${error.message}`);
      });
      for (const topic of removed) {
        const idIot = this.topicToIdIot.get(topic);
        if (idIot) this.cache.delete(idIot);
      }
    }
    if (added.length || removed.length) {
      this.logger.log(`MQTT device topics updated: +${added.length} -${removed.length} (active: ${target.size})`);
    }

    this.topicToIdIot = target;
  }

  private scheduleTopicWatcher(segments: string[], placeholderIndex: number): void {
    this.topicWatcherTimer = setTimeout(() => {
      void this.refreshDbDrivenTopics(segments, placeholderIndex).finally(() => {
        this.scheduleTopicWatcher(segments, placeholderIndex);
      });
    }, this.topicWatchMs);
    this.topicWatcherTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.topicWatcherTimer) clearTimeout(this.topicWatcherTimer);
    this.client?.end(true);
  }

  private handleMessage(topic: string, payload: Buffer): void {
    let data: unknown;
    try {
      data = JSON.parse(payload.toString());
    } catch {
      this.logger.error(`MQTT poll failed: message on '${topic}' is not valid JSON`);
      return;
    }

    // DB-driven {id_iot} mode: the topic was subscribed verbatim per device
    // (built from — and possibly itself containing — '/'), so the id_iot is
    // recovered from the topicToIdIot map, never by positional splitting.
    // {ip}-wildcard mode: the matched field comes from the topic segment
    // itself. Flat-topic mode: read whichever field flatMatchField names
    // from the payload.
    const matchField = this.placeholderSegmentIndex === -1 ? this.flatMatchField : this.placeholderField;
    const key = this.dbDrivenIdIot
      ? this.topicToIdIot.get(topic) ?? ''
      : this.placeholderSegmentIndex === -1
        ? String((data as Record<string, unknown>)?.[matchField] ?? '').trim()
        : topic.split('/')[this.placeholderSegmentIndex];
    if (!key) {
      this.logger.error(`MQTT poll failed: message on '${topic}' has no '${matchField}'`);
      return;
    }

    const inputs = (data as { inputs?: unknown })?.inputs;
    if (!Array.isArray(inputs)) {
      this.logger.error(`MQTT poll failed: message on '${topic}' has no 'inputs' array`);
      return;
    }

    if (this.verbosePollLogging) {
      this.logger.log(`MQTT poll OK: ${topic} ${matchField}=${key} inputs=${JSON.stringify(inputs)}`);
    }

    // Mutates the existing entry's arrays in place when the shape matches — the hot
    // ingest path (this handler) can fire far more often than any tier reads it, so
    // reallocating a new entry/arrays per message was pure per-message churn. Safe
    // only because `getLatest` hands callers a defensive copy (below), never this
    // live array — a caller can hold an acquisition's `inputs`/`counts` past this
    // tick (e.g. `MachineService.pendingFrontendUpdates`, up to ~1s) and must not
    // see it change out from under it.
    let entry = this.cache.get(key);
    if (!entry) {
      entry = { inputs: inputs.map(Boolean), counts: new Array(10).fill(0), receivedAt: Date.now() };
      this.cache.set(key, entry);
    } else if (entry.inputs.length === inputs.length) {
      for (let i = 0; i < inputs.length; i++) entry.inputs[i] = Boolean(inputs[i]);
    } else {
      entry.inputs = inputs.map(Boolean);
    }

    if (this.readCountsEnabled) {
      const rawCounts = (data as { counts?: unknown })?.counts;
      if (!Array.isArray(rawCounts)) {
        this.logger.warn(`MQTT poll: message on '${topic}' has no 'counts' array — defaulting to zeros`);
      }
      const counts = buildChannelCounters(Array.isArray(rawCounts) ? rawCounts : []);
      if (entry.counts.length === counts.length) {
        for (let i = 0; i < counts.length; i++) entry.counts[i] = counts[i];
      } else {
        entry.counts = counts;
      }
      if (this.verbosePollLogging) {
        this.logger.log(`MQTT poll OK: ${topic} ${matchField}=${key} counts=${JSON.stringify(entry.counts)}`);
      }
    }

    entry.receivedAt = Date.now();
  }

  /**
   * Latest channel acquisition for a machine, matched by whichever field this
   * deployment is configured to key by (`ip` or `id_iot`) — null when never
   * seen, stale, or the relevant field is unset on this machine.
   */
  getLatestForMachine(ip: string | null, idIot: string | null): ChannelAcquisition | null {
    const matchField =
      this.placeholderSegmentIndex !== -1 ? this.placeholderField : this.flatMatchField;
    return this.getLatest(matchField === 'id_iot' ? idIot : ip);
  }

  /**
   * Latest channel acquisition for a raw cache key; null when never seen, stale, or unset.
   * Returns copies of `inputs`/`counts`, not the cache entry's live arrays — those are
   * mutated in place on the next MQTT message (see `handleMessage`), so a caller holding
   * this result past the current tick must not see it change underneath it.
   */
  private getLatest(key: string | null): ChannelAcquisition | null {
    if (!key) return null;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.receivedAt > this.stalenessMs) return null;
    return {
      lookup: buildChannelLookup(entry.inputs),
      inputs: entry.inputs.slice(),
      counts: entry.counts.slice(),
    };
  }

  /**
   * Epoch ms of the last message actually received for a machine — unlike
   * `getLatestForMachine`, not gated by `stalenessMs`, since "last seen" needs
   * the raw last-message time even long after the device has gone stale.
   */
  getLastReceivedAt(ip: string | null, idIot: string | null): number | null {
    const matchField =
      this.placeholderSegmentIndex !== -1 ? this.placeholderField : this.flatMatchField;
    const key = matchField === 'id_iot' ? idIot : ip;
    if (!key) return null;
    return this.cache.get(key)?.receivedAt ?? null;
  }
}
