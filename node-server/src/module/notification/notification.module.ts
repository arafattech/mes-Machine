import { Module } from '@nestjs/common';
import { NotificationController } from '@module/notification/notification.controller';
import { NotificationService } from '@module/notification/notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
