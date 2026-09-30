import { Routes } from '@nestjs/core';
import { BiometricsModule } from '@module/biometrics/biometrics.module';

export const BiometricsRoutes: Routes = [
  {
    path: 'biometrics',
    module: BiometricsModule,
  },
];
