import { Body, Controller, Post } from '@nestjs/common';
import { NotificationService, NotificationPayload } from '@module/notification/notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('store-requisition')
  broadcastStoreRequisition(@Body() payload: NotificationPayload): { ok: boolean } {
    this.notificationService.broadcastStoreRequisitionCreated(payload);
    return { ok: true };
  }
}
