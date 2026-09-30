import { Routes } from '@nestjs/core';
import { EmployeeWeekendsModule } from '@module/hrm/employee-weekends/employee-weekends.module';

export const HrmRoutes: Routes = [
  {
    path: 'hrm/employee-weekends',
    module: EmployeeWeekendsModule,
  },
];
