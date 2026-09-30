export enum YarnAdviceStatus {
  DRAFT = 'draft',
  HOD_APPROVED = 'hod_approved',
  STORE_RECEIVED = 'store_received',
  GM_APPROVED = 'gm_approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum YarnAdviceLineStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  REJECTED = 'REJECTED',
}

export class YarnAdviceStatusClass {
  static getStateTranslate(state: YarnAdviceStatus): string {
    switch (state) {
      case YarnAdviceStatus.DRAFT:
        return $localize`Draft`;
      case YarnAdviceStatus.HOD_APPROVED:
        return $localize`HOD Approved`;
      case YarnAdviceStatus.STORE_RECEIVED:
        return $localize`Store Received`;
      case YarnAdviceStatus.GM_APPROVED:
        return $localize`GM Approved`;
      case YarnAdviceStatus.REJECTED:
        return $localize`Rejected`;
      case YarnAdviceStatus.CANCELLED:
        return $localize`Cancelled`;
      default:
        return '';
    }
  }
}
