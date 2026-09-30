import { NotificationRoutes } from '@module/notification/route';
import { BiometricsRoutes } from '@module/biometrics/route';
import { MachineRoutes } from '@module/machine/route';
import { ImportRoute } from '@module/import/route';
import { SalesForecastRoutes } from '@module/sales-forecast/route';
import { HrmRoutes } from '@module/hrm/route';

import { Routes } from '@nestjs/core';
export const apiRoutes: Routes = [
  ...NotificationRoutes,
  ...BiometricsRoutes,
  ...MachineRoutes,
  ...ImportRoute,
  ...SalesForecastRoutes,
  ...HrmRoutes,
];
