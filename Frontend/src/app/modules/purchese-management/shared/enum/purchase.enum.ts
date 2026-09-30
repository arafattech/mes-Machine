export enum PurchaseOrderStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
  CANCELED = "CANCELED",
  CANCELLED = "CANCELLED",
  SUBMITTED = "SUBMITTED",
  PARTIAL = "PARTIAL",
}

export class PurchaseOrderStatusClass {
  static normalize(status: string): PurchaseOrderStatus {
    const value = String(status ?? "").toUpperCase();

    switch (value) {
      case PurchaseOrderStatus.COMPLETED:
        return PurchaseOrderStatus.APPROVED;
      case PurchaseOrderStatus.REJECTED:
      case PurchaseOrderStatus.CANCELLED:
      case PurchaseOrderStatus.PARTIAL:
        return PurchaseOrderStatus.CANCELED;
      case PurchaseOrderStatus.APPROVED:
      case PurchaseOrderStatus.CANCELED:
      case PurchaseOrderStatus.PENDING:
      case PurchaseOrderStatus.SUBMITTED:
        return value as PurchaseOrderStatus;
      default:
        return PurchaseOrderStatus.PENDING;
    }
  }

  static getIconName(status: string): string {
    const value = this.normalize(status);

    switch (value) {
      case PurchaseOrderStatus.APPROVED:
        return "accept";
      case PurchaseOrderStatus.REJECTED:
      case PurchaseOrderStatus.CANCELED:
        return "decline";
      case PurchaseOrderStatus.PENDING:
      case PurchaseOrderStatus.SUBMITTED:
        return "lateness";
      default:
        return "";
    }
  }

  static getLabel(status: string): string {
    const value = this.normalize(status);
    return value.charAt(0) + value.slice(1).toLowerCase();
  }
}
