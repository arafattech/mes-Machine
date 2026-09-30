export const statusStyles: Record<
  string,
  { backgroundColor: string; label: string; color?: string }
> = {
  approved: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'Approved',
  },
  pending: {
    backgroundColor: 'rgba(255, 165, 0, 0.25)',
    label: 'Pending',
  },
  expired: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Expired',
  },
  rejected: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Rejected',
  },
  declined: {
    backgroundColor: 'rgba(220, 53, 69, 0.5)',
    label: 'Declined',
  },
  processed: {
    backgroundColor: 'rgba(0, 123, 255, 0.25)',
    label: 'Processed',
  },
 
  PAID: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    label: 'Paid',
  },
  UNPAID: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    label: 'Unpaid',
  },
  is_read: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'YES',
  },
  is_unread: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'NO',
  },
  APPROVED: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'Approved',
  },
  FINAL_APPROVAL: {
    backgroundColor: 'rgba(40, 167, 69, 0.45)',
    label: 'Final Approved',
  },
  REJECTED: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Rejected',
  },
  SUBMITTED: {
    backgroundColor: 'rgba(0, 45, 255, 0.41)',
    label: 'Submitted',
  },
  LATE: {
    backgroundColor: 'rgba(255, 152, 0, 0.35)',
    label: 'Late',
  },
  Normal: {
    backgroundColor: 'rgba(40, 167, 69, 0.5)',
    label: 'Normal',
  },
  Critical: {
    backgroundColor: 'rgba(213, 89, 89, 0.8)',
    label: 'Critical',
  },
  'Low Stock': {
    backgroundColor: 'rgba(213, 89, 89, 0.8)',
    label: 'Low Stock',
  },
  DRAFT: {
    backgroundColor: 'rgba(172, 172, 172, 0.8)',
    label: 'DRAFT',
  },
  PENDING: {
    backgroundColor: 'rgba(98, 130, 245, 0.26)',
    label: 'PENDING',
  },
  PARTIAL: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    label: 'PARTIAL',
  },
  COMPLETED: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'COMPLETED',
  },
  connected: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'Connected',
  },
  reconnecting: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    label: 'Reconnecting',
  },
  disconnected: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Offline',
  },
  CANCELLED: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'CANCELLED',
  },
  CANCELED: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Canceled',
  },
  GENERATED: {
    backgroundColor: 'rgba(40, 167, 69, 0.25)',
    label: 'Generated',
  },
  blacklisted: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Blacklisted',
  },
  reverted: {
    backgroundColor: 'rgba(255, 165, 0, 0.25)',
    label: 'Reverted',
  },
  CREATED: {
    backgroundColor: 'rgba(40, 167, 69, 0.25)',
    color: '#155724',
    label: 'PO Created',
  },
  NOT_CREATED: {
    backgroundColor: 'rgba(173, 181, 189, 0.3)',
    color: '#495057',
    label: 'Not Created',
  },
  active: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'Active',
  },
  idle: {
    backgroundColor: 'rgba(255, 165, 0, 0.25)',
    label: 'Idle',
  },
  inactive: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Inactive',
  },
  maintenance: {
    backgroundColor: 'rgba(108, 117, 125, 0.25)',
    label: 'Maintenance',
  },
  scheduled: {
    backgroundColor: 'rgba(0, 123, 255, 0.25)',
    label: 'Scheduled',
  },
  ended: {
    backgroundColor: 'rgba(108, 117, 125, 0.25)',
    label: 'Ended',
  },
  in_progress: {
    backgroundColor: 'rgba(0, 123, 255, 0.25)',
    label: 'In Progress',
  },
  completed: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'Completed',
  },
  cancelled: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Cancelled',
  },
  LOCAL: {
    backgroundColor: 'rgba(0, 123, 255, 0.25)',
    label: 'Local',
  },
  FOREIGN: {
    backgroundColor: 'rgba(111, 66, 193, 0.25)',
    label: 'Foreign',
  },
  OVERTIME: {
    backgroundColor: 'rgba(0, 123, 255, 0.25)',
    label: 'Overtime',
  },
  RAMADAN: {
    backgroundColor: 'rgba(111, 66, 193, 0.25)',
    label: 'Ramadan Duty',
  },
  EID: {
    backgroundColor: 'rgba(40, 167, 69, 0.25)',
    label: 'Eid Duty',
  },
  HOLIDAY: {
    backgroundColor: 'rgba(40, 167, 69, 0.25)',
    label: 'Holiday Bonus',
  },
  EXTRA_SHIFT: {
    backgroundColor: 'rgba(255, 140, 0, 0.25)',
    label: 'Extra Shift',
  },
  VALID: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'Valid',
  },
  INVALID: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'Invalid',
  },
  EXTRA: {
    backgroundColor: 'rgba(0, 123, 255, 0.25)',
    label: 'Extra',
  },
  REGULAR: {
    backgroundColor: 'rgba(172, 172, 172, 0.3)',
    label: 'Regular',
  },
  DOFFED: {
    backgroundColor: 'rgba(98, 130, 245, 0.26)',
    label: 'Doffed',
  },
  QC_FAILED: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'QC Failed',
  },
  PACKED: {
    backgroundColor: 'rgba(0, 123, 255, 0.25)',
    label: 'Packed',
  },
  PENDING_TRANSFER: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    label: 'Pending Transfer',
  },
  RECEIVED: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'Received',
  },
  RECONCILED: {
    backgroundColor: 'rgba(40, 167, 69, 0.5)',
    label: 'Reconciled',
  },
  draft: {
    backgroundColor: 'rgba(172, 172, 172, 0.3)',
    label: 'Draft',
  },
  hod_approved: {
    backgroundColor: 'rgba(98, 130, 245, 0.26)',
    label: 'HOD Approved',
  },
  store_received: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    label: 'Store Received',
  },
  gm_approved: {
    backgroundColor: 'rgba(40, 167, 69, 0.5)',
    label: 'GM Approved',
  },
  HIGH: {
    backgroundColor: 'rgba(220, 53, 69, 0.25)',
    label: 'HIGH',
  },
  MEDIUM: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    label: 'MEDIUM',
  },
  LOW: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    label: 'LOW',
  },
};

/** Same lookup `AgGridStatusBadgeComponent` uses, for status pills rendered outside a grid cell. */
export function getStatusStyle(status?: string | null): { backgroundColor: string; color: string; label: string } {
  const style = statusStyles[status ?? ''];
  return {
    backgroundColor: style?.backgroundColor ?? 'rgba(172, 172, 172, 0.3)',
    color: style?.color ?? 'inherit',
    label: style?.label ?? (status || ''),
  };
}
