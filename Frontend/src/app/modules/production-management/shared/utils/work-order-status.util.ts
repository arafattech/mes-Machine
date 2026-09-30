const WORK_ORDER_STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'var(--sapCriticalColor, #e76500)',
  in_progress: 'var(--sapPositiveColor, #257a3e)',
  completed: 'var(--sapNeutralColor, #6a6d70)',
  cancelled: 'var(--sapNegativeColor, #bb0000)',
};

const WORK_ORDER_STATUS_TINT_MAP: Record<string, string> = {
  pending: 'var(--sapWarningBackground, #fef7f1)',
  in_progress: 'var(--sapSuccessBackground, #f1fdf6)',
  completed: 'var(--sapNeutralBackground, #f5f6f7)',
  cancelled: 'var(--sapErrorBackground, #ffebeb)',
};

const WORK_ORDER_STATUS_LABEL_MAP: Record<string, string> = {
  pending: $localize`Pending`,
  in_progress: $localize`In Progress`,
  completed: $localize`Completed`,
  cancelled: $localize`Cancelled`,
};

const FALLBACK_COLOR = 'var(--sapNeutralColor, #6a6d70)';
const FALLBACK_TINT = 'var(--sapNeutralBackground, #f5f6f7)';

export function getWorkOrderStatusColor(status: string | null): string {
  return WORK_ORDER_STATUS_COLOR_MAP[status ?? ''] ?? FALLBACK_COLOR;
}

export function getWorkOrderStatusTint(status: string | null): string {
  return WORK_ORDER_STATUS_TINT_MAP[status ?? ''] ?? FALLBACK_TINT;
}

export function getWorkOrderStatusLabel(status: string | null): string {
  return WORK_ORDER_STATUS_LABEL_MAP[status ?? ''] ?? status ?? '';
}
