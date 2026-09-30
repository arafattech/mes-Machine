export enum LotStatus {
  DOFFED = 'DOFFED',
  QC_FAILED = 'QC_FAILED',
  PACKED = 'PACKED',
  PENDING_TRANSFER = 'PENDING_TRANSFER',
  REJECTED = 'REJECTED',
  RECEIVED = 'RECEIVED',
  RECONCILED = 'RECONCILED',
  CANCELLED = 'CANCELLED',
}

export class LotStatusClass {
  static getStateTranslate(state: LotStatus): string {
    switch (state) {
      case LotStatus.DOFFED:
        return $localize`Doffed`;
      case LotStatus.QC_FAILED:
        return $localize`QC Failed`;
      case LotStatus.PACKED:
        return $localize`Packed`;
      case LotStatus.PENDING_TRANSFER:
        return $localize`Pending Transfer`;
      case LotStatus.REJECTED:
        return $localize`Rejected`;
      case LotStatus.RECEIVED:
        return $localize`Received`;
      case LotStatus.RECONCILED:
        return $localize`Reconciled`;
      case LotStatus.CANCELLED:
        return $localize`Cancelled`;
      default:
        return '';
    }
  }
}
