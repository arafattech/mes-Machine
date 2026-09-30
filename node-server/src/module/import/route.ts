import { Routes } from '@nestjs/core';
import { ImportModule } from '@module/import/import.module';

export const ImportRoute: Routes = [
  {
    path: 'import',
    module: ImportModule,
  },
];
