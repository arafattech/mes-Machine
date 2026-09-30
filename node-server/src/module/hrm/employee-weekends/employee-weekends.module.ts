import { Module } from '@nestjs/common';
import { EmployeeWeekendsController } from '@module/hrm/employee-weekends/employee-weekends.controller';
import { EmployeeWeekendsService } from '@module/hrm/employee-weekends/employee-weekends.service';
import { PrismaService } from '@prisma/prisma.service';

@Module({
  controllers: [EmployeeWeekendsController],
  providers: [EmployeeWeekendsService, PrismaService],
})
export class EmployeeWeekendsModule {}
