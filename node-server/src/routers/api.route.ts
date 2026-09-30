import { MachineRoutes } from '@module/machine/route';
import { ImportRoute } from '@module/import/route';

import { Routes } from '@nestjs/core';
export const apiRoutes: Routes = [
  ...MachineRoutes,
  ...ImportRoute,
];
