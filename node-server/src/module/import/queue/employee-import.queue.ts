import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { socketService } from '../../../config/socket/socket.config';
import {
  EmployeeImportJobData,
  EmployeeImportProcessorService,
} from '../services/employee-import.service';

const QUEUE_NAME = 'employee-import';

@Injectable()
export class EmployeeImportQueueService implements OnModuleInit, OnModuleDestroy {
  private connection!: IORedis;
  private queue!: Queue<EmployeeImportJobData>;
  private worker!: Worker<EmployeeImportJobData>;

  constructor(private readonly processor: EmployeeImportProcessorService) {}

  onModuleInit(): void {
    // BullMQ requires this exact option on its Redis connection.
    this.connection = process.env.REDIS_URL
      ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      : new IORedis({ maxRetriesPerRequest: null });

    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });

    this.worker = new Worker<EmployeeImportJobData>(
      QUEUE_NAME,
      (job: Job<EmployeeImportJobData>) => this.processor.runImportJob(job.data),
      { connection: this.connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      console.error('Employee import job failed:', err);
      if (job?.data?.jobId) {
        socketService.emit('employee-import:failed', {
          jobId: job.data.jobId,
          error: err.message,
        });
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  async enqueue(data: EmployeeImportJobData): Promise<void> {
    await this.queue.add('import', data, {
      removeOnComplete: true,
      removeOnFail: 20,
    });
  }
}
