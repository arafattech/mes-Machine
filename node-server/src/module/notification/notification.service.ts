import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { socketService } from 'config/socket/socket.config';

export interface NotificationPayload {
  model_id: number;
  model_custom_id: string;
  sender_id: number;
  sender_name: string;
  recipient_user_ids?: number[];
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  onModuleInit(): void {
    socketService.on('base-data-department:created', (_, payload: NotificationPayload) => {
      this.broadcastDepartmentCreated(payload);
    });
    socketService.on('base-data-department:updated', (_, payload: NotificationPayload) => {
      this.broadcastDepartmentUpdated(payload);
    });
    socketService.on('base-data-department:deleted', (_, payload: NotificationPayload) => {
      this.broadcastDepartmentDeleted(payload);
    });
  }

  broadcastDepartmentCreated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'BASE_DATA_DEPARTMENT_CREATE',
      model_type: 'Department',
      ...payload,
      title: `New Department Created (#${payload.model_custom_id})`,
      message: `${payload.sender_name} created a new Department (#${payload.model_custom_id}).`,
    });
  }

  broadcastDepartmentUpdated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'BASE_DATA_DEPARTMENT_EDIT',
      model_type: 'Department',
      ...payload,
      title: `Department Updated (#${payload.model_custom_id})`,
      message: `${payload.sender_name} updated Department (#${payload.model_custom_id}).`,
    });
  }

  broadcastDepartmentDeleted(payload: NotificationPayload): void {
    this.broadcast({
      type: 'BASE_DATA_DEPARTMENT_DELETE',
      model_type: 'Department',
      ...payload,
      title: `Department Deleted (#${payload.model_custom_id})`,
      message: `${payload.sender_name} deleted Department (#${payload.model_custom_id}).`,
    });
  }

  private broadcast(data: Record<string, unknown>): void {
    try {
      socketService.getServer().emit('notification:new', data);
      this.logger.log(`Broadcast notification:new — type: ${data['type']}`);
    } catch (err) {
      this.logger.warn(`Socket not ready — dropped notification:new: ${err}`);
    }
  }
}
