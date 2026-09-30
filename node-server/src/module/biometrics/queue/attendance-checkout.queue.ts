import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';
import moment from 'moment';

const QUEUE_NAME = 'attendance-checkout-sync';

export interface AttendanceCheckoutJobData {
  attendanceLogId: string;
  checkOutTime: string;
}

/**
 * Throttled bridge to Laravel's checkout endpoint (AttendanceCheckoutService /
 * OvertimeBonusService — overtime + all bonus calculation lives there, not duplicated
 * here). A burst of device punches (multiple employees checking out at once) would
 * otherwise fire one Laravel HTTP request per punch concurrently; queuing + a rate
 * limiter keeps that a steady, bounded trickle instead of a thundering herd.
 */
@Injectable()
export class AttendanceCheckoutQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttendanceCheckoutQueueService.name);
  private connection!: IORedis;
  private queue!: Queue<AttendanceCheckoutJobData>;
  private worker!: Worker<AttendanceCheckoutJobData>;

  onModuleInit(): void {
    this.connection = process.env.REDIS_URL
      ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      : new IORedis({ maxRetriesPerRequest: null });

    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });

    this.worker = new Worker<AttendanceCheckoutJobData>(
      QUEUE_NAME,
      (job: Job<AttendanceCheckoutJobData>) => this.syncCheckoutWithLaravel(job.data),
      {
        connection: this.connection,
        concurrency: 3,
        // Cap outbound Laravel calls to 5/second regardless of how fast punches queue up.
        limiter: { max: 5, duration: 1000 },
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Checkout sync failed for attendance_log ${job?.data?.attendanceLogId}: ${err.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  async enqueue(data: AttendanceCheckoutJobData): Promise<void> {
    await this.queue.add('checkout-sync', data, {
      removeOnComplete: true,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private async syncCheckoutWithLaravel(data: AttendanceCheckoutJobData): Promise<void> {
    const laravelBaseUrl = process.env.LARAVEL_URL?.replace(/\/+$/, '');
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

    if (!laravelBaseUrl || !internalToken) {
      this.logger.warn(
        'Skipped Laravel checkout bonus sync — LARAVEL_URL/INTERNAL_SERVICE_TOKEN not configured.',
      );
      return;
    }

    // Hits the internal/* route (VerifyInternalServiceToken middleware) — no user
    // session exists for device-originated checkouts, so this can't use auth:sanctum.
    await axios.put(
      `${laravelBaseUrl}/api/internal/attendance/${data.attendanceLogId}/checkout`,
      { check_out_time: data.checkOutTime },
      {
        headers: {
          'X-Internal-Token': internalToken,
          Accept: 'application/json',
        },
        timeout: Number(process.env.LARAVEL_TIMEOUT ?? 30000),
      },
    );
  }
}

export function formatCheckoutTime(date: Date): string {
  return moment.utc(date).format('YYYY-MM-DD HH:mm:ss');
}
