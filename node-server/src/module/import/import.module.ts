import { Module } from '@nestjs/common';
import { ImportController } from '@module/import/import.controller';
import { ImportService } from '@module/import/import.service';
import { EmployeeImportProcessorService } from '@module/import/services/employee-import.service';
import { EmployeeImportQueueService } from '@module/import/queue/employee-import.queue';
import { PrismaService } from '@prisma/prisma.service';

@Module({
  controllers: [ImportController],
  providers: [
    ImportService,
    EmployeeImportProcessorService,
    EmployeeImportQueueService,
    PrismaService,
  ],
})
export class ImportModule {}
