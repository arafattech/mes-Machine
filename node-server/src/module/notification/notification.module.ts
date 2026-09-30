import { Module } from '@nestjs/common';
import { NotificationService } from '@module/notification/notification.service';

@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
