import { Injectable, Logger } from '@nestjs/common';
import { GetRedisClient } from 'config/redis/config.redis';

/**
 * Reads the manual-maintenance override set (`machine:maintenance_overrides`,
 * written by the Laravel backend via MachineMaintenanceOverrideSignal on the
 * shared unprefixed Redis connection — same key space this service's ioredis
 * client reads).
 *
 * The set holds machine *DB ids* (machines.id, stringified) — matching
 * `ChannelRuntimeConfig.id`, which is `machine_id`, not the config id.
 *
 * Overrides are polled per machine per tick, so the set is cached locally for
 * 1s to avoid hammering Redis; on a Redis error the stale cache is kept
 * (fail-open — an override missed means a machine briefly shows its real
 * status until the cache recovers). `clear()` also evicts from the cache.
 */
@Injectable()
export class MaintenanceOverrideService {
  private readonly logger = new Logger(MaintenanceOverrideService.name);
  private readonly redis = GetRedisClient();
  private readonly overridesKey = 'machine:maintenance_overrides';
  private readonly cacheTtlMs = 1000;

  private cache: Set<string> | null = null;
  private cacheExpiresAt = 0;

  /** Current override set — cached up to 1s, fail-open to the stale cache. */
  async getOverrides(): Promise<Set<string>> {
    const now = Date.now();
    if (this.cache !== null && now < this.cacheExpiresAt) return this.cache;

    try {
      const members = await this.redis.smembers(this.overridesKey);
      this.cache = new Set(members);
      this.cacheExpiresAt = now + this.cacheTtlMs;
      return this.cache;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to read maintenance overrides from Redis — using stale cache (${message})`,
      );
      return this.cache ?? new Set();
    }
  }

  /** True when `machineId` (machines.id, as string) is under manual maintenance. */
  async isOverridden(machineId: string): Promise<boolean> {
    return (await this.getOverrides()).has(machineId);
  }

  /** Remove a machine from the override set (manual End or auto-clear). */
  async clear(machineId: string): Promise<void> {
    try {
      await this.redis.srem(this.overridesKey, machineId);
      this.cache?.delete(machineId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to clear maintenance override for machine ${machineId}: ${message}`,
      );
    }
  }

  /**
   * Add a machine to the override set. node-server's own counterpart to
   * Laravel's `MachineMaintenanceOverrideSignal::activate()` — used when the
   * post-maintenance verification window re-arms a schedule row because the
   * machine dropped out of Active before `pending_confirm_until` (see
   * `MachineStateTrackerService.reopenMaintenanceSession`).
   */
  async activate(machineId: string): Promise<void> {
    try {
      await this.redis.sadd(this.overridesKey, machineId);
      this.cache?.add(machineId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to set maintenance override for machine ${machineId}: ${message}`,
      );
    }
  }
}
