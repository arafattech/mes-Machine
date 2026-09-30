import { Routes } from '@nestjs/core';
import { MachineModule } from '@module/machine/machine.module';

export const MachineRoutes: Routes = [
  {
    path: 'machine',
    module: MachineModule,
  },
];
