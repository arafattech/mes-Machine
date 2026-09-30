import { Routes } from '@nestjs/core';
import { NotificationModule } from '@module/notification/notification.module';

export const NotificationRoutes: Routes = [
  {
    path: 'notification',
    module: NotificationModule,
  },
];
