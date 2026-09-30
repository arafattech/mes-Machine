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
    socketService.on('store-requisition:created', (_, payload: NotificationPayload) => {
      this.broadcastStoreRequisitionCreated(payload);
    });
    socketService.on('store-requisition:approved', (_, payload: NotificationPayload) => {
      this.broadcastSrApproved(payload);
    });
    socketService.on('store-requisition:rejected', (_, payload: NotificationPayload) => {
      this.broadcastSrRejected(payload);
    });
    socketService.on('store-localrrm:created', (_, payload: NotificationPayload) => {
      this.broadcastLocalMrrCreated(payload);
    });
    socketService.on('store-importedmrr:created', (_, payload: NotificationPayload) => {
      this.broadcastImportedMrrCreated(payload);
    });
    socketService.on('store-mrr:received', (_, payload: NotificationPayload) => {
      this.broadcastMrrReceived(payload);
    });
    socketService.on('store-spr:created', (_, payload: NotificationPayload) => {
      this.broadcastSprCreated(payload);
    });
    socketService.on('store-spr:approved', (_, payload: NotificationPayload) => {
      this.broadcastSprApproved(payload);
    });
    socketService.on('store-spr:rejected', (_, payload: NotificationPayload) => {
      this.broadcastSprRejected(payload);
    });
    socketService.on('store-reminder:created', (_, payload: NotificationPayload) => {
      this.broadcastReminderCreated(payload);
    });
    socketService.on('store-reminder:read', (_, payload: NotificationPayload) => {
      this.broadcastReminderRead(payload);
    });
    socketService.on('base-data-department:created', (_, payload: NotificationPayload) => {
      this.broadcastDepartmentCreated(payload);
    });
    socketService.on('base-data-department:updated', (_, payload: NotificationPayload) => {
      this.broadcastDepartmentUpdated(payload);
    });
    socketService.on('base-data-department:deleted', (_, payload: NotificationPayload) => {
      this.broadcastDepartmentDeleted(payload);
    });
    socketService.on('hrm-leave:applied', (_, payload: NotificationPayload) => {
      this.broadcastLeaveApplied(payload);
    });
    socketService.on('hrm-leave:supervisor-approved', (_, payload: NotificationPayload) => {
      this.broadcastLeaveSupervisorApproved(payload);
    });
    socketService.on('hrm-leave:supervisor-rejected', (_, payload: NotificationPayload) => {
      this.broadcastLeaveSupervisorRejected(payload);
    });
    socketService.on('hrm-leave:hr-approved', (_, payload: NotificationPayload) => {
      this.broadcastLeaveHrApproved(payload);
    });
    socketService.on('hrm-leave:hr-rejected', (_, payload: NotificationPayload) => {
      this.broadcastLeaveHrRejected(payload);
    });
    socketService.on('hrm-notice:created', (_, payload: NotificationPayload) => {
      this.broadcastNoticeCreated(payload);
    });
    socketService.on('sales-order:created', (_, payload: NotificationPayload) => {
      this.broadcastSalesOrderCreated(payload);
    });
    socketService.on('sales-order:sent', (_, payload: NotificationPayload) => {
      this.broadcastSalesOrderSent(payload);
    });
    socketService.on('sales-order:approved', (_, payload: NotificationPayload) => {
      this.broadcastSalesOrderApproved(payload);
    });
    socketService.on('sales-order:rejected', (_, payload: NotificationPayload) => {
      this.broadcastSalesOrderRejected(payload);
    });
  }

  broadcastStoreRequisitionCreated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_STORE_REQUISITION_CREATE',
      model_type: 'PurchaseRequisition',
      ...payload,
      title: `New SR Created (#${payload.model_custom_id})`,
      message: `${payload.sender_name} created a new Store Requisition (#${payload.model_custom_id}).`,
    });
  }

  broadcastLocalMrrCreated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_LOCAL_MRR_CREATE',
      model_type: 'MaterialReceipt',
      ...payload,
      title: `New Local MRR Created (#${payload.model_custom_id})`,
      message: `${payload.sender_name} created a new Local Material Receipt (#${payload.model_custom_id}).`,
    });
  }

  broadcastImportedMrrCreated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_LOCAL_MRR_CREATE',
      model_type: 'MaterialReceipt',
      ...payload,
      title: `New Imported MRR Created (#${payload.model_custom_id})`,
      message: `${payload.sender_name} created a new Imported Material Receipt (#${payload.model_custom_id}).`,
    });
  }

  broadcastMrrReceived(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_LOCAL_MRR_EDIT',
      model_type: 'MaterialReceipt',
      ...payload,
      title: `MRR Product Received (#${payload.model_custom_id})`,
      message: `${payload.sender_name} received product quantity for MRR (#${payload.model_custom_id}).`,
    });
  }

  broadcastSprCreated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_PURCHASE_REQUISITION_CREATE',
      model_type: 'PurchaseRequisition',
      ...payload,
      title: `New Indent Created (#${payload.model_custom_id})`,
      message: `${payload.sender_name} created a new Indent Requisition (#${payload.model_custom_id}).`,
    });
  }

  broadcastSprApproved(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_PURCHASE_REQUISITION_APPROVE',
      model_type: 'PurchaseRequisition',
      ...payload,
      title: `Indent Approved (#${payload.model_custom_id})`,
      message: `${payload.sender_name} approved Indent Requisition (#${payload.model_custom_id}).`,
    });
  }

  broadcastSprRejected(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_PURCHASE_REQUISITION_REJECT',
      model_type: 'PurchaseRequisition',
      ...payload,
      title: `Indent Rejected (#${payload.model_custom_id})`,
      message: `${payload.sender_name} rejected Indent Requisition (#${payload.model_custom_id}).`,
    });
  }

  broadcastReminderCreated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_REMINDERS_CREATE',
      model_type: 'Reminder',
      ...payload,
      title: `New Reminder Created (#${payload.model_custom_id})`,
      message: `${payload.sender_name} created a new Reminder for MRR (#${payload.model_custom_id}).`,
    });
  }

  broadcastReminderRead(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_REMINDERS_UPDATE',
      model_type: 'Reminder',
      ...payload,
      title: `Reminder Read (#${payload.model_custom_id})`,
      message: `${payload.sender_name} marked Reminder (#${payload.model_custom_id}) as read.`,
    });
  }

  broadcastSrApproved(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_STORE_REQUISITION_APPROVE',
      model_type: 'PurchaseRequisition',
      ...payload,
      title: `SR Approved (#${payload.model_custom_id})`,
      message: `${payload.sender_name} approved Store Requisition (#${payload.model_custom_id}).`,
    });
  }

  broadcastSrRejected(payload: NotificationPayload): void {
    this.broadcast({
      type: 'STORE_STORE_REQUISITION_REJECT',
      model_type: 'PurchaseRequisition',
      ...payload,
      title: `SR Rejected (#${payload.model_custom_id})`,
      message: `${payload.sender_name} rejected Store Requisition (#${payload.model_custom_id}).`,
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

  broadcastLeaveApplied(payload: NotificationPayload): void {
    this.broadcast({
      type: 'HR_LEAVE_REQUEST_APPROVE',
      model_type: 'LeaveRequest',
      ...payload,
      title: `New Leave Request (#${payload.model_id})`,
      message: `${payload.sender_name} has applied for leave.`,
    });
  }

  broadcastLeaveSupervisorApproved(payload: NotificationPayload): void {
    this.broadcast({
      type: 'HR_LEAVE_REQUEST_APPROVE',
      model_type: 'LeaveRequest',
      ...payload,
      title: `Leave Approved by Supervisor (#${payload.model_id})`,
      message: `${payload.sender_name} approved a leave request.`,
    });
  }

  broadcastLeaveSupervisorRejected(payload: NotificationPayload): void {
    this.broadcast({
      type: 'HR_LEAVE_REQUEST_VIEW',
      model_type: 'LeaveRequest',
      ...payload,
      title: `Leave Rejected by Supervisor (#${payload.model_id})`,
      message: `${payload.sender_name} rejected a leave request.`,
    });
  }

  broadcastLeaveHrApproved(payload: NotificationPayload): void {
    this.broadcast({
      type: 'HR_LEAVE_REQUEST_VIEW',
      model_type: 'LeaveRequest',
      ...payload,
      title: `Leave Approved by HR (#${payload.model_id})`,
      message: `${payload.sender_name} approved a leave request.`,
    });
  }

  broadcastLeaveHrRejected(payload: NotificationPayload): void {
    this.broadcast({
      type: 'HR_LEAVE_REQUEST_VIEW',
      model_type: 'LeaveRequest',
      ...payload,
      title: `Leave Rejected by HR (#${payload.model_id})`,
      message: `${payload.sender_name} rejected a leave request.`,
    });
  }

  broadcastNoticeCreated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'HR_NOTICE_CREATE',
      model_type: 'Notice',
      ...payload,
      title: `New Notice Published (#${payload.model_custom_id})`,
      message: `${payload.sender_name} published a new notice.`,
    });
  }

  broadcastSalesOrderCreated(payload: NotificationPayload): void {
    this.broadcast({
      type: 'SALES_SALES_ORDER_CREATE',
      model_type: 'SalesOrder',
      ...payload,
      title: `New Sales Order Created (#${payload.model_custom_id})`,
      message: `${payload.sender_name} created a new Sales Order (#${payload.model_custom_id}).`,
    });
  }

  broadcastSalesOrderSent(payload: NotificationPayload): void {
    this.broadcast({
      type: 'SALES_SALES_REQUEST_APPROVE',
      model_type: 'SalesOrder',
      ...payload,
      title: `Sales Order Forwarded (#${payload.model_custom_id})`,
      message: `${payload.sender_name} forwarded Sales Order (#${payload.model_custom_id}) for approval.`,
    });
  }

  broadcastSalesOrderApproved(payload: NotificationPayload): void {
    this.broadcast({
      type: 'SALES_SALES_REQUEST_APPROVE',
      model_type: 'SalesOrder',
      ...payload,
      title: `Sales Order Approved (#${payload.model_custom_id})`,
      message: `${payload.sender_name} approved Sales Order (#${payload.model_custom_id}).`,
    });
  }

  broadcastSalesOrderRejected(payload: NotificationPayload): void {
    this.broadcast({
      type: 'SALES_SALES_REQUEST_REJECT',
      model_type: 'SalesOrder',
      ...payload,
      title: `Sales Order Rejected (#${payload.model_custom_id})`,
      message: `${payload.sender_name} rejected Sales Order (#${payload.model_custom_id}).`,
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
