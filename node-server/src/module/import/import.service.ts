import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { EmployeeImportProcessorService } from '@module/import/services/employee-import.service';
import { EmployeeImportQueueService } from '@module/import/queue/employee-import.queue';

@Injectable()
export class ImportService {
  constructor(
    private readonly employeeImportProcessorService: EmployeeImportProcessorService,
    private readonly employeeImportQueueService: EmployeeImportQueueService,
  ) {}

  async importEmployees(request: Request, file?: Express.Multer.File) {
    const rows = this.employeeImportProcessorService.parseExcelFile(file);
    const token = request.headers?.authorization
      ? String(request.headers.authorization).replace(/^Bearer\s+/i, '')
      : null;

    const jobId = randomUUID();
    await this.employeeImportQueueService.enqueue({ jobId, rows, token });

    return {
      jobId,
      total_rows: rows.length,
      status: 'queued',
    };
  }
}
