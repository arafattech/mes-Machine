import { Routes } from '@nestjs/core';
import { SalesForecastModule } from '@module/sales-forecast/sales-forecast.module';

export const SalesForecastRoutes: Routes = [
  {
    path: 'sales/forecast',
    module: SalesForecastModule,
  },
];
