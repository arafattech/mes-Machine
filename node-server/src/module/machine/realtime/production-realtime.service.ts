import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { CreateRedisConnection, GetRedisClient } from 'config/redis/config.redis';
import { socketService } from 'config/socket/socket.config';
import {
  BumpCalcVersions,
  PRODUCTION_EVENTS_CHANNEL,
  ParseProductionEvent,
} from '@module/machine/realtime/production-events';

const DEFAULT_COALESCE_MS = 1000;

/**
 * Turns `mes:production-events` (Redis pub/sub) into one coalesced
 * `machine_production_updated` socket broadcast per window:
 *   1. bumps the calc-cache version of every affected machine / work order, so the
 *      frontend's refetch can't be served a pre-change cached result;
 *   2. emits `{machine_ids, work_order_ids, types}` — clients refetch only what they show.
 * Coalescing (trailing, `PRODUCTION_EVENT_COALESCE_MS`, default 1000) caps the push rate at
 * one message per window for the whole fleet, however many shots / writes land in it.
 */
@Injectable()
export class ProductionRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductionRealtimeService.name);
  private readonly redis = GetRedisClient();
  private readonly coalesceMs = this.resolveCoalesceMs();

  // Subscriber mode blocks every other command on its connection — needs its own.
  private subscriber: Redis | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly pendingMachineIds = new Set<number>();
  private readonly pendingWorkOrderIds = new Set<number>();
  private readonly pendingTypes = new Set<string>();

  async onModuleInit(): Promise<void> {
    this.subscriber = CreateRedisConnection();
    this.subscriber.on('message', (_channel, message) => this.enqueue(message));
    this.subscriber.on('error', (error) => this.logger.warn(`Production events subscriber error: ${error.message}`));
    try {
      await this.subscriber.subscribe(PRODUCTION_EVENTS_CHANNEL);
      this.logger.log(`Subscribed to ${PRODUCTION_EVENTS_CHANNEL}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to subscribe to ${PRODUCTION_EVENTS_CHANNEL}: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    await this.subscriber?.quit();
  }

  private resolveCoalesceMs(): number {
    const configured = Number(process.env.PRODUCTION_EVENT_COALESCE_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_COALESCE_MS;
  }

  private enqueue(message: string): void {
    const event = ParseProductionEvent(message);
    if (!event || (event.machine_ids.length === 0 && event.work_order_ids.length === 0)) {
      this.logger.warn(`Dropped malformed production event: ${message.slice(0, 200)}`);
      return;
    }

    for (const id of event.machine_ids) this.pendingMachineIds.add(id);
    for (const id of event.work_order_ids) this.pendingWorkOrderIds.add(id);
    this.pendingTypes.add(event.type);

    this.flushTimer ??= setTimeout(() => void this.flush(), this.coalesceMs);
  }

  private async flush(): Promise<void> {
    this.flushTimer = null;
    const machineIds = [...this.pendingMachineIds];
    const workOrderIds = [...this.pendingWorkOrderIds];
    const types = [...this.pendingTypes];
    this.pendingMachineIds.clear();
    this.pendingWorkOrderIds.clear();
    this.pendingTypes.clear();

    try {
      await BumpCalcVersions(this.redis, machineIds, workOrderIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Calc cache version bump failed (TTL still bounds staleness): ${message}`);
    }

    socketService.emit('machine_production_updated', {
      machine_ids: machineIds,
      work_order_ids: workOrderIds,
      types,
    });
  }
}
